package case_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"it-project-showcase/backend/internal/models"
)

var ErrRoundWindow = errors.New("round is not open for submissions")
var ErrRoundData = errors.New("invalid round solutions or scores")
var ErrRoundAlreadySubmitted = errors.New("round already submitted")
var ErrEventPlanRequired = errors.New("event plan and deadlines are required")

const eventManager = `EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=c.company_id
	AND m.user_id=NULLIF($2,'')::uuid AND m.status='active' AND m.permissions ? 'manage_company')`

func (r *Repository) SetEventPlan(ctx context.Context, user, caseID string, plan models.EventPlan) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockMutableStages(ctx, tx, user, caseID); err != nil {
		return err
	}
	var format, workFormat string
	if err = tx.QueryRowContext(ctx, `SELECT event_format,work_format FROM cases WHERE case_id=$1`, caseID).Scan(&format, &workFormat); err != nil {
		return err
	}
	if (format != "hackathon" && format != "olympiad") || (format == "olympiad" && len(plan.Rounds) == 0) ||
		((workFormat == "onsite" || workFormat == "hybrid") && (plan.VenueName == "" || plan.Address == "")) ||
		((workFormat == "remote" || workFormat == "hybrid") && (plan.PlatformName == "" || plan.PlatformURL == "")) {
		return ErrRoundData
	}
	for _, round := range plan.Rounds {
		for _, task := range round.Tasks {
			for _, file := range task.FileIDs {
				if err = verifyEventFile(ctx, tx, file, user); err != nil {
					return err
				}
			}
		}
	}
	data, err := json.Marshal(plan)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO event_plans(case_id,plan) VALUES($1,$2::jsonb)
		ON CONFLICT(case_id) DO UPDATE SET plan=EXCLUDED.plan`, caseID, string(data)); err != nil {
		return err
	}
	return tx.Commit()
}

func verifyEventFile(ctx context.Context, tx *sql.Tx, file, owner string) error {
	var found bool
	err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM files WHERE file_id=$1 AND uploaded_by=$2 AND status='active')`, file, owner).Scan(&found)
	if err != nil {
		return err
	}
	if !found {
		return ErrReferenceNotFound
	}
	return nil
}

func (r *Repository) GetEventPlan(ctx context.Context, user, caseID string, admin bool) (*models.EventPlan, error) {
	var raw, allowed []byte
	var participant bool
	err := r.db.QueryRowContext(ctx, `SELECT p.plan,
		COALESCE((SELECT jsonb_agg(x->>'round_id') FROM jsonb_array_elements(p.plan->'rounds') x
			WHERE showcase.can_read_event_tasks(c.case_id,NULLIF($2,'')::uuid,$3,(x->>'opens_at')::timestamptz)),'[]'::jsonb),
		showcase.can_read_event_tasks(c.case_id,NULLIF($2,'')::uuid,$3,'-infinity'::timestamptz)
		FROM event_plans p JOIN cases c ON c.case_id=p.case_id WHERE p.case_id=$1 AND
		((c.visibility='public' AND c.status IN ('published','in_progress','completed')) OR $3 OR `+eventManager+`
		OR showcase.can_read_event_tasks(c.case_id,NULLIF($2,'')::uuid,$3,'-infinity'::timestamptz))`, caseID, user, admin).Scan(&raw, &allowed, &participant)
	if err != nil {
		return nil, err
	}
	var plan models.EventPlan
	var ids []string
	if err = json.Unmarshal(raw, &plan); err != nil {
		return nil, err
	}
	if err = json.Unmarshal(allowed, &ids); err != nil {
		return nil, err
	}
	visible := make(map[string]bool, len(ids))
	for _, id := range ids {
		visible[id] = true
	}
	for i := range plan.Rounds {
		if !visible[plan.Rounds[i].RoundID] {
			plan.Rounds[i].Tasks = []models.EventTask{}
		}
	}
	if !participant {
		plan.PlatformURL = ""
	}
	return &plan, nil
}

func getExecutionRound(ctx context.Context, tx *sql.Tx, execution, user, round string, admin, grading bool) (*models.EventRound, error) {
	var caseID string
	err := tx.QueryRowContext(ctx, `SELECT c.case_id FROM executions e JOIN cases c ON c.case_id=e.case_id
		WHERE e.execution_id=$1 FOR UPDATE OF c`, execution).Scan(&caseID)
	if errors.Is(err, sql.ErrNoRows) { return nil, ErrAccessDenied }
	if err != nil { return nil, err }
	var data []byte
	err = tx.QueryRowContext(ctx, `SELECT x.value FROM executions e JOIN cases c ON c.case_id=e.case_id
		JOIN event_plans p ON p.case_id=c.case_id CROSS JOIN LATERAL jsonb_array_elements(p.plan->'rounds') x(value)
		WHERE e.execution_id=$1 AND x.value->>'round_id'=$3 AND e.status<>'cancelled' AND
		(($5 AND ($4 OR `+eventManager+`)) OR (NOT $5 AND c.status IN ('published','in_progress')
			AND EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2::uuid AND m.left_at IS NULL)
			AND showcase.can_read_event_tasks(c.case_id,$2::uuid,false,'-infinity'::timestamptz)))
		AND NOT EXISTS(SELECT 1 FROM case_placements cp WHERE cp.case_id=c.case_id)`, execution, user, round, admin, grading).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, err
	}
	var item models.EventRound
	err = json.Unmarshal(data, &item)
	return &item, err
}

func (r *Repository) SubmitEventRound(ctx context.Context, user, execution, roundID string, solutions []models.EventSolution) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	round, err := getExecutionRound(ctx, tx, execution, user, roundID, false, false)
	if err != nil {
		return err
	}
	tasks := make(map[string]bool, len(round.Tasks))
	for _, task := range round.Tasks {
		tasks[task.TaskID] = true
	}
	for _, solution := range solutions {
		if !tasks[solution.TaskID] {
			return ErrRoundData
		}
		if solution.FileID != "" {
			if err = verifyEventFile(ctx, tx, solution.FileID, user); err != nil {
				return err
			}
		}
	}
	data, err := json.Marshal(solutions)
	if err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO event_round_submissions(execution_id,round_id,submitted_by,solutions)
		SELECT $1,$2,$3,$4::jsonb WHERE statement_timestamp()>=$5 AND statement_timestamp()<=$6
		ON CONFLICT DO NOTHING`, execution, roundID, user, string(data), round.OpensAt, round.DueAt)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		var exists bool
		if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM event_round_submissions WHERE execution_id=$1 AND round_id=$2)`, execution, roundID).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return ErrRoundAlreadySubmitted
		}
		return ErrRoundWindow
	}
	return tx.Commit()
}

func (r *Repository) GradeEventRound(ctx context.Context, user, execution, roundID string, admin bool, scores []models.EventTaskScore) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	round, err := getExecutionRound(ctx, tx, execution, user, roundID, admin, true)
	if err != nil {
		return err
	}
	if len(round.Tasks) != len(scores) {
		return ErrRoundData
	}
	maximums := make(map[string]float64, len(round.Tasks))
	var total, maximum float64
	for _, task := range round.Tasks {
		maximums[task.TaskID] = task.MaxScore
		maximum += task.MaxScore
	}
	for _, score := range scores {
		limit, ok := maximums[score.TaskID]
		if !ok || score.Score > limit {
			return ErrRoundData
		}
		total += score.Score
	}
	data, err := json.Marshal(scores)
	if err != nil {
		return err
	}
	var submitted time.Time
	err = tx.QueryRowContext(ctx, `UPDATE event_round_submissions SET scores=$3::jsonb,total_score=$4,max_score=$5,evaluated_by=$6,evaluated_at=statement_timestamp()
		WHERE execution_id=$1 AND round_id=$2 RETURNING submitted_at`, execution, roundID, string(data), total, maximum, user).Scan(&submitted)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) ListEventRoundSubmissions(ctx context.Context, user, execution string, admin bool) ([]models.EventRoundSubmission, error) {
	var manager, allowed bool
	err := r.db.QueryRowContext(ctx, `SELECT ($3 OR `+eventManager+`),($3 OR `+eventManager+` OR EXISTS(
		SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2::uuid AND m.left_at IS NULL))
		FROM executions e JOIN cases c ON c.case_id=e.case_id WHERE e.execution_id=$1`, execution, user, admin).Scan(&manager, &allowed)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !allowed) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT s.round_id,s.execution_id,s.submitted_at,s.solutions,COALESCE(s.scores,'[]'::jsonb),
		s.total_score,s.max_score,s.evaluated_at,CASE WHEN $2 THEN COALESCE(u.username,'') ELSE '' END,
		CASE WHEN $2 THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('file_id',f.file_id,'original_name',f.original_name,
			'mime_type',f.mime_type,'size_bytes',f.size_bytes) ORDER BY f.file_id) FROM files f
			WHERE f.status='active' AND f.file_id IN (SELECT NULLIF(x->>'file_id','')::uuid FROM jsonb_array_elements(s.solutions) x)),'[]'::jsonb) ELSE '[]'::jsonb END
		FROM event_round_submissions s LEFT JOIN users u ON u.user_id=s.evaluated_by WHERE s.execution_id=$1 ORDER BY s.submitted_at,s.round_id`, execution, manager)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.EventRoundSubmission, 0)
	for rows.Next() {
		var item models.EventRoundSubmission
		var solutions, scores, metadata []byte
		if err = rows.Scan(&item.RoundID, &item.ExecutionID, &item.SubmittedAt, &solutions, &scores, &item.TotalScore, &item.MaxScore, &item.EvaluatedAt, &item.EvaluatorName, &metadata); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(solutions, &item.Solutions); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(scores, &item.Scores); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(metadata, &item.FileMetadata); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
