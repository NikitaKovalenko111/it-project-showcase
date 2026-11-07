package case_repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"it-project-showcase/backend/internal/models"
)

func (r *Repository) ListDeadlineChanges(ctx context.Context, user, caseID string, admin bool, limit int, offset int64) ([]models.CaseDeadlineChange, int64, error) {
	var allowed bool
	err := r.db.QueryRowContext(ctx, `SELECT ($3 OR `+eventManager+`) FROM cases c WHERE c.case_id=$1`, caseID, user, admin).Scan(&allowed)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !allowed) {
		return nil, 0, ErrAccessDenied
	}
	if err != nil {
		return nil, 0, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT change_id,case_id,stage_id,round_id,changed_by,previous_due_at,due_at,reason,changed_at
		FROM case_deadline_changes WHERE case_id=$1 ORDER BY changed_at DESC,change_id DESC LIMIT $2 OFFSET $3`, caseID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]models.CaseDeadlineChange, 0)
	for rows.Next() {
		var item models.CaseDeadlineChange
		if err = rows.Scan(&item.ChangeID, &item.CaseID, &item.StageID, &item.RoundID, &item.ChangedBy, &item.PreviousDueAt, &item.DueAt, &item.Reason, &item.ChangedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int64
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM case_deadline_changes WHERE case_id=$1`, caseID).Scan(&total)
	return items, total, err
}

func (r *Repository) ChangeDeadline(ctx context.Context, actor, caseID, stageID, roundID string, dueAt time.Time, reason string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var previous *time.Time
	var status string
	err = tx.QueryRowContext(ctx, `SELECT c.due_at,c.status FROM cases c WHERE c.case_id=$1
		AND EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company')
		FOR UPDATE OF c`, caseID, actor).Scan(&previous, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrAccessDenied
	}
	if err != nil {
		return err
	}
	if status != "published" && status != "in_progress" {
		return ErrInvalidTransition
	}
	var roundIndex int64
	if roundID != "" {
		var opensAt time.Time
		err = tx.QueryRowContext(ctx, `SELECT (x.value->>'due_at')::timestamptz,(x.value->>'opens_at')::timestamptz,x.ordinality-1
			FROM event_plans p CROSS JOIN LATERAL jsonb_array_elements(p.plan->'rounds') WITH ORDINALITY x(value,ordinality)
			WHERE p.case_id=$1 AND x.value->>'round_id'=$2`, caseID, roundID).Scan(&previous, &opensAt, &roundIndex)
		if err != nil {
			return err
		}
		if !dueAt.After(opensAt) {
			return ErrRoundData
		}
	} else if stageID != "" {
		if err = tx.QueryRowContext(ctx, `SELECT due_at FROM case_stages WHERE case_id=$1 AND stage_id=$2 FOR UPDATE`, caseID, stageID).Scan(&previous); err != nil {
			return err
		}
	}
	if previous != nil && previous.Equal(dueAt) {
		return tx.Commit()
	}
	if roundID != "" {
		if _, err = tx.ExecContext(ctx, `UPDATE event_plans SET plan=jsonb_set(plan,ARRAY['rounds',$2::text,'due_at'],to_jsonb($3::text),false)
			WHERE case_id=$1`, caseID, fmt.Sprint(roundIndex), dueAt.UTC().Format(time.RFC3339Nano)); err != nil {
			return err
		}
	} else if stageID == "" {
		if _, err = tx.ExecContext(ctx, `UPDATE cases SET due_at=$2 WHERE case_id=$1`, caseID, dueAt); err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE executions SET due_at=$2 WHERE case_id=$1 AND status NOT IN ('closed','cancelled')`, caseID, dueAt); err != nil {
			return err
		}
	} else if _, err = tx.ExecContext(ctx, `UPDATE case_stages SET due_at=$3 WHERE case_id=$1 AND stage_id=$2`, caseID, stageID, dueAt); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO case_deadline_changes(case_id,stage_id,changed_by,previous_due_at,due_at,reason,round_id)
		VALUES($1,NULLIF($2,'')::uuid,$3,$4,$5,$6,NULLIF($7,'')::uuid)`, caseID, stageID, actor, previous, dueAt, reason, roundID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO notifications(user_id,type,title,body,resource_type,resource_id,metadata)
		SELECT DISTINCT m.student_id,'case_deadline_changed','Изменён срок сдачи',$4,'case',e.case_id,
			jsonb_build_object('stage_id',NULLIF($2,'')::uuid,'round_id',NULLIF($5,'')::uuid,'due_at',$3::timestamptz)
		FROM executions e JOIN execution_members m ON m.execution_id=e.execution_id AND m.left_at IS NULL
		WHERE e.case_id=$1 AND e.status NOT IN ('closed','cancelled')`, caseID, stageID, dueAt, reason, roundID); err != nil {
		return err
	}
	return tx.Commit()
}
