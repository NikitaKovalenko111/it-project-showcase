package execution_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"it-project-showcase/backend/internal/models"
)

var (
	ErrForbidden  = errors.New("execution access denied")
	ErrTransition = errors.New("invalid transition")
)

type Repository struct{ db *sql.DB }

const executionSelect = `SELECT e.execution_id,e.case_id,c.title,e.application_id,e.team_id,e.status,e.started_at,e.due_at,e.ended_at,e.created_at,
COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id',m.student_id,'name',concat_ws(' ',s.last_name,s.first_name,s.patronymic),'role_id',m.role_id,'role_name',COALESCE(r.name,''),'joined_at',m.joined_at,'left_at',m.left_at) ORDER BY m.joined_at,m.student_id) FROM execution_members m JOIN students s ON s.user_id=m.student_id LEFT JOIN team_roles r ON r.team_role_id=m.role_id WHERE m.execution_id=e.execution_id),'[]'::jsonb)
FROM executions e JOIN cases c ON c.case_id=e.case_id`

func scanExecution(row interface{ Scan(...any) error }) (*models.Execution, error) {
	var item models.Execution
	var members []byte
	if err := row.Scan(&item.ExecutionID, &item.CaseID, &item.CaseTitle, &item.ApplicationID, &item.TeamID, &item.Status, &item.StartedAt, &item.DueAt, &item.EndedAt, &item.CreatedAt, &members); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(members, &item.Members); err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) getExecution(ctx context.Context, user, id string, company bool) (*models.Execution, error) {
	return scanExecution(r.db.QueryRowContext(ctx, executionSelect+` WHERE e.execution_id=$1 AND (EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')))`, id, user, company))
}

func Init(db *sql.DB) *Repository { return &Repository{db: db} }
func (r *Repository) authorize(ctx context.Context, user, id string, company, admin bool) error {
	var allowed bool
	err := r.db.QueryRowContext(ctx, `SELECT ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))) FROM executions e JOIN cases c ON c.case_id=e.case_id WHERE e.execution_id=$1`, id, user, company, admin).Scan(&allowed)
	if errors.Is(err, sql.ErrNoRows) || !allowed {
		return ErrForbidden
	}
	return err
}
func (r *Repository) ListStages(ctx context.Context, user, id string, company, admin bool) ([]models.ExecutionStage, error) {
	if err := r.authorize(ctx, user, id, company, admin); err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT s.stage_id,s.ordinal,s.title,COALESCE(s.expected_result,''),s.due_at,x.status,COALESCE(x.feedback,''),x.completed_at,x.updated_at FROM executions e JOIN cases c ON c.case_id=e.case_id JOIN execution_stages x ON x.execution_id=e.execution_id JOIN case_stages s ON s.stage_id=x.stage_id WHERE e.execution_id=$1 AND ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))) ORDER BY s.ordinal`, id, user, company, admin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutionStage, 0)
	for rows.Next() {
		var x models.ExecutionStage
		if err = rows.Scan(&x.StageID, &x.Ordinal, &x.Title, &x.ExpectedResult, &x.DueAt, &x.Status, &x.Feedback, &x.CompletedAt, &x.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) UpdateStage(ctx context.Context, user, executionID, stageID, status, feedback string, company bool) (*models.ExecutionStage, error) {
	var x models.ExecutionStage
	err := r.db.QueryRowContext(ctx, `UPDATE execution_stages x SET status=$4,feedback=CASE WHEN $5 THEN NULLIF($6,'') ELSE feedback END,completed_at=CASE WHEN $4='accepted' THEN CURRENT_TIMESTAMP ELSE NULL END FROM executions e JOIN cases c ON c.case_id=e.case_id,case_stages s WHERE x.execution_id=$1 AND x.stage_id=$2 AND e.execution_id=x.execution_id AND s.stage_id=x.stage_id AND (($5 AND x.status='submitted' AND $4 IN ('accepted','revision') AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company')) OR (NOT $5 AND ((x.status IN ('pending','revision') AND $4='in_progress') OR (x.status='in_progress' AND $4='submitted')) AND EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$3 AND m.left_at IS NULL))) RETURNING s.stage_id,s.ordinal,s.title,COALESCE(s.expected_result,''),s.due_at,x.status,COALESCE(x.feedback,''),x.completed_at,x.updated_at`, executionID, stageID, user, status, company, feedback).Scan(&x.StageID, &x.Ordinal, &x.Title, &x.ExpectedResult, &x.DueAt, &x.Status, &x.Feedback, &x.CompletedAt, &x.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err == nil && status == "accepted" {
		_, err = r.db.ExecContext(ctx, `UPDATE executions e SET status='done',ended_at=CURRENT_TIMESTAMP WHERE e.execution_id=$1 AND NOT EXISTS(SELECT 1 FROM execution_stages x WHERE x.execution_id=e.execution_id AND x.status<>'accepted')`, executionID)
	}
	return &x, err
}
func (r *Repository) AddComment(ctx context.Context, user, executionID string, stageID *string, body string, company, admin bool) (*models.ExecutionComment, error) {
	var x models.ExecutionComment
	err := r.db.QueryRowContext(ctx, `INSERT INTO execution_comments(execution_id,stage_id,author_id,body) SELECT e.execution_id,$2,$3,$4 FROM executions e JOIN cases c ON c.case_id=e.case_id WHERE e.execution_id=$1 AND ($6 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$3 AND m.left_at IS NULL) OR ($5 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company'))) RETURNING comment_id,execution_id,stage_id,author_id,body,created_at`, executionID, stageID, user, body, company, admin).Scan(&x.CommentID, &x.ExecutionID, &x.StageID, &x.AuthorID, &x.Body, &x.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return &x, err
}
func (r *Repository) ListComments(ctx context.Context, user, executionID string, company, admin bool, limit int, before *time.Time, beforeID string) ([]models.ExecutionComment, error) {
	if err := r.authorize(ctx, user, executionID, company, admin); err != nil {
		return nil, err
	}
	q := `SELECT x.comment_id,x.execution_id,x.stage_id,x.author_id,x.body,x.created_at FROM execution_comments x JOIN executions e ON e.execution_id=x.execution_id JOIN cases c ON c.case_id=e.case_id WHERE x.execution_id=$1 AND ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')))`
	args := []any{executionID, user, company, admin}
	if before != nil {
		args = append(args, *before, beforeID)
		q += fmt.Sprintf(" AND (x.created_at,x.comment_id)<($%d,$%d)", len(args)-1, len(args))
	}
	args = append(args, limit)
	q += fmt.Sprintf(" ORDER BY x.created_at DESC,x.comment_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutionComment, 0)
	for rows.Next() {
		var x models.ExecutionComment
		if err = rows.Scan(&x.CommentID, &x.ExecutionID, &x.StageID, &x.AuthorID, &x.Body, &x.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) AddMentor(ctx context.Context, user, executionID, mentorID, role string) (*models.ExecutionMentor, error) {
	var x models.ExecutionMentor
	err := r.db.QueryRowContext(ctx, `INSERT INTO execution_mentors(execution_id,user_id,role_name) SELECT e.execution_id,$3,$4 FROM executions e JOIN cases c ON c.case_id=e.case_id WHERE e.execution_id=$1 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id=ur.role_id WHERE ur.user_id=$3 AND r.code IN ('mentor','university_staff')) RETURNING execution_id,user_id,role_name,assigned_at`, executionID, user, mentorID, role).Scan(&x.ExecutionID, &x.UserID, &x.RoleName, &x.AssignedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return &x, err
}
func (r *Repository) ListMentors(ctx context.Context, user, executionID string, company, admin bool) ([]models.ExecutionMentor, error) {
	if err := r.authorize(ctx, user, executionID, company, admin); err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT m.execution_id,m.user_id,m.role_name,m.assigned_at FROM execution_mentors m JOIN executions e ON e.execution_id=m.execution_id JOIN cases c ON c.case_id=e.case_id WHERE m.execution_id=$1 AND ($4 OR EXISTS(SELECT 1 FROM execution_members x WHERE x.execution_id=e.execution_id AND x.student_id=$2 AND x.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))) ORDER BY m.assigned_at,m.user_id`, executionID, user, company, admin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutionMentor, 0)
	for rows.Next() {
		var x models.ExecutionMentor
		if err = rows.Scan(&x.ExecutionID, &x.UserID, &x.RoleName, &x.AssignedAt); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) UpdateExecutionStatus(ctx context.Context, user, id, status string, company bool) (*models.Execution, error) {
	current, err := scanExecution(r.db.QueryRowContext(ctx, executionSelect+` WHERE e.execution_id=$1`, id))
	if err != nil {
		return nil, err
	}
	allowed := (!company && status == "in_progress" && current.Status == "accepted") || (company && status == "cancelled" && (current.Status == "accepted" || current.Status == "in_progress")) || (company && status == "closed" && current.Status == "done")
	if !allowed {
		return nil, ErrTransition
	}
	condition := `EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=$1 AND m.student_id=$2 AND m.left_at IS NULL)`
	if company {
		condition = `EXISTS(SELECT 1 FROM executions e JOIN cases c ON c.case_id=e.case_id JOIN company_members cm ON cm.company_id=c.company_id WHERE e.execution_id=$1 AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')`
	}
	res, err := r.db.ExecContext(ctx, `UPDATE executions SET status=$3,started_at=CASE WHEN $3='in_progress' THEN CURRENT_TIMESTAMP ELSE started_at END,ended_at=CASE WHEN $3 IN ('closed','cancelled') THEN CURRENT_TIMESTAMP ELSE ended_at END WHERE execution_id=$1 AND `+condition, id, user, status)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrForbidden
	}
	return r.getExecution(ctx, user, id, company)
}
func (r *Repository) ListNDA(ctx context.Context, user, caseID string, company, admin bool) ([]models.NDAGrant, error) {
	var allowed bool
	err := r.db.QueryRowContext(ctx, `SELECT ($4 OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')) OR (c.nda_required AND c.status IN ('published','in_progress') AND EXISTS(SELECT 1 FROM students s WHERE s.user_id=$2))) FROM cases c WHERE c.case_id=$1`, caseID, user, company, admin).Scan(&allowed)
	if errors.Is(err, sql.ErrNoRows) || !allowed {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT n.nda_grant_id,n.case_id,n.student_id,n.status,n.granted_at,n.evidence_file_id,n.updated_at FROM nda_grants n JOIN cases c ON c.case_id=n.case_id WHERE n.case_id=$1 AND ($4 OR n.student_id=$2 OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))) ORDER BY n.updated_at DESC`, caseID, user, company, admin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.NDAGrant, 0)
	for rows.Next() {
		var x models.NDAGrant
		if err = rows.Scan(&x.NDAGrantID, &x.CaseID, &x.StudentID, &x.Status, &x.GrantedAt, &x.EvidenceFileID, &x.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) RequestNDA(ctx context.Context, user, caseID string) (*models.NDAGrant, error) {
	var x models.NDAGrant
	err := r.db.QueryRowContext(ctx, `INSERT INTO nda_grants(case_id,student_id) SELECT c.case_id,$2 FROM cases c JOIN students s ON s.user_id=$2 WHERE c.case_id=$1 AND c.nda_required AND c.status IN ('published','in_progress') RETURNING nda_grant_id,case_id,student_id,status,granted_at,evidence_file_id,updated_at`, caseID, user).Scan(&x.NDAGrantID, &x.CaseID, &x.StudentID, &x.Status, &x.GrantedAt, &x.EvidenceFileID, &x.UpdatedAt)
	return &x, err
}
func (r *Repository) UpdateNDA(ctx context.Context, user, id, status string, evidence *string) (*models.NDAGrant, error) {
	var x models.NDAGrant
	err := r.db.QueryRowContext(ctx, `UPDATE nda_grants n SET status=$3,granted_at=CASE WHEN $3='granted' THEN CURRENT_TIMESTAMP ELSE NULL END,evidence_file_id=$4 FROM cases c WHERE n.nda_grant_id=$1 AND c.case_id=n.case_id AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM files f WHERE f.file_id=$4 AND f.uploaded_by=$2 AND f.status='active')) RETURNING n.nda_grant_id,n.case_id,n.student_id,n.status,n.granted_at,n.evidence_file_id,n.updated_at`, id, user, status, evidence).Scan(&x.NDAGrantID, &x.CaseID, &x.StudentID, &x.Status, &x.GrantedAt, &x.EvidenceFileID, &x.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return &x, err
}
