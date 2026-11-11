package case_repo

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"it-project-showcase/backend/internal/models"
)

var ErrPlanChanged = errors.New("case plan changed")
var ErrPlanDeadline = errors.New("plan deadline requires a future date and reason")

func (r *Repository) SavePlan(ctx context.Context, userID, caseID string, input models.CasePlanUpdate) ([]models.CaseStage, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var status string
	var publishedResults bool
	err = tx.QueryRowContext(ctx, `SELECT c.status
		FROM cases c WHERE c.case_id=$1 AND EXISTS(SELECT 1 FROM company_members m WHERE
		m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company')
		FOR UPDATE OF c`, caseID, userID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM case_placements WHERE case_id=$1)`, caseID).Scan(&publishedResults); err != nil {
		return nil, err
	}
	active := status == "published" || status == "in_progress"
	if publishedResults || (!active && status != "draft" && status != "revision") {
		return nil, ErrStagesLocked
	}
	rows, err := tx.QueryContext(ctx, `SELECT stage_id,title,COALESCE(expected_result,''),due_at
		FROM case_stages WHERE case_id=$1 ORDER BY ordinal FOR UPDATE`, caseID)
	if err != nil {
		return nil, err
	}
	current, err := readPlan(rows)
	if err != nil {
		return nil, err
	}
	if len(current) != len(input.Previous) {
		return nil, ErrPlanChanged
	}
	byID := make(map[string]models.CasePlanStage, len(current))
	for i, stage := range current {
		previous := input.Previous[i]
		if stage.StageID != previous.StageID || stage.Title != previous.Title ||
			stage.ExpectedResult != previous.ExpectedResult || !sameDeadline(stage.DueAt, previous.DueAt) {
			return nil, ErrPlanChanged
		}
		byID[stage.StageID] = stage
	}
	kept := make(map[string]bool, len(input.Stages))
	for _, stage := range input.Stages {
		if stage.StageID == "" {
			continue
		}
		previous, ok := byID[stage.StageID]
		if !ok {
			return nil, ErrPlanChanged
		}
		if active && !sameDeadline(previous.DueAt, stage.DueAt) &&
			(input.Reason == "" || stage.DueAt == nil || !stage.DueAt.After(time.Now())) {
			return nil, ErrPlanDeadline
		}
		kept[stage.StageID] = true
	}

	if _, err = tx.ExecContext(ctx, `SET CONSTRAINTS case_stages_case_id_ordinal_key DEFERRED`); err != nil {
		return nil, err
	}
	for _, stage := range current {
		if kept[stage.StageID] {
			continue
		}
		if err = removeUnusedStage(ctx, tx, stage.StageID); err != nil {
			return nil, err
		}
	}

	result := make([]models.CaseStage, 0, len(input.Stages))
	for i, stage := range input.Stages {
		ordinal := i + 1
		if stage.StageID == "" {
			err = tx.QueryRowContext(ctx, `INSERT INTO case_stages(case_id,ordinal,title,expected_result,due_at)
				VALUES ($1,$2,$3,NULLIF($4,''),$5) RETURNING stage_id`, caseID, ordinal, stage.Title, stage.ExpectedResult, stage.DueAt).Scan(&stage.StageID)
			if err != nil {
				return nil, err
			}
			_, err = tx.ExecContext(ctx, `INSERT INTO execution_stages(execution_id,stage_id)
				SELECT execution_id,$2 FROM executions WHERE case_id=$1 AND status NOT IN ('closed','cancelled')`, caseID, stage.StageID)
		} else {
			_, err = tx.ExecContext(ctx, `UPDATE case_stages SET ordinal=$2,title=$3,expected_result=NULLIF($4,''),due_at=$5
				WHERE stage_id=$1`, stage.StageID, ordinal, stage.Title, stage.ExpectedResult, stage.DueAt)
			if err == nil && active && !sameDeadline(byID[stage.StageID].DueAt, stage.DueAt) {
				err = recordDeadlineChange(ctx, tx, userID, caseID, stage.StageID, "", byID[stage.StageID].DueAt, *stage.DueAt, input.Reason)
			}
		}
		if err != nil {
			return nil, err
		}
		result = append(result, models.CaseStage{StageID: stage.StageID, CaseID: caseID, Ordinal: ordinal,
			Title: stage.Title, ExpectedResult: stage.ExpectedResult, DueAt: stage.DueAt})
	}
	return result, tx.Commit()
}

func readPlan(rows *sql.Rows) ([]models.CasePlanStage, error) {
	defer rows.Close()
	var stages []models.CasePlanStage
	for rows.Next() {
		var stage models.CasePlanStage
		if err := rows.Scan(&stage.StageID, &stage.Title, &stage.ExpectedResult, &stage.DueAt); err != nil {
			return nil, err
		}
		stages = append(stages, stage)
	}
	return stages, rows.Err()
}

func sameDeadline(left, right *time.Time) bool {
	if left == nil || right == nil {
		return left == right
	}
	return left.Equal(*right)
}

func removeUnusedStage(ctx context.Context, tx *sql.Tx, stageID string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM execution_stages WHERE stage_id=$1 AND status='pending'
		AND feedback IS NULL AND completed_at IS NULL`, stageID); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `DELETE FROM case_stages s WHERE s.stage_id=$1
		AND NOT EXISTS(SELECT 1 FROM execution_stages x WHERE x.stage_id=s.stage_id)
		AND NOT EXISTS(SELECT 1 FROM submissions x WHERE x.stage_id=s.stage_id)
		AND NOT EXISTS(SELECT 1 FROM execution_comments x WHERE x.stage_id=s.stage_id)`, stageID)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil || n == 0 {
		if err != nil {
			return err
		}
		return ErrStagesLocked
	}
	return nil
}
