package application_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"
	"time"
)

var (
	ErrForbidden         = errors.New("application access denied")
	ErrInvalidTransition = errors.New("invalid application transition")
	ErrCaseUnavailable   = errors.New("case unavailable")
	ErrConsentPending    = errors.New("application consents pending")
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

const applicationSelect = `SELECT a.application_id,a.case_id,c.title,a.case_revision_id,c.company_id,company.full_name,a.submitted_by,a.student_id,a.team_id,COALESCE(t.name,''),COALESCE(a.cover_letter,''),a.resume_file_id,COALESCE(a.portfolio_url,''),COALESCE(a.github_url,''),a.status,COALESCE(a.company_notes,''),(SELECT count(*) FROM application_consents x WHERE x.application_id=a.application_id),CASE WHEN a.team_id IS NULL THEN 1 ELSE (SELECT count(*) FROM team_members m WHERE m.team_id=a.team_id AND m.left_at IS NULL) END,e.execution_id,a.submitted_at,a.updated_at FROM applications a JOIN cases c ON c.case_id=a.case_id JOIN companies company ON company.company_id=c.company_id LEFT JOIN teams t ON t.team_id=a.team_id LEFT JOIN executions e ON e.application_id=a.application_id`

func scanApplication(row interface{ Scan(...any) error }) (*models.Application, error) {
	var a models.Application
	err := row.Scan(&a.ApplicationID, &a.CaseID, &a.CaseTitle, &a.CaseRevisionID, &a.CompanyID, &a.CompanyName, &a.SubmittedBy, &a.StudentID, &a.TeamID, &a.TeamName, &a.CoverLetter, &a.ResumeFileID, &a.PortfolioURL, &a.GithubURL, &a.Status, &a.CompanyNotes, &a.ConsentCount, &a.MemberCount, &a.ExecutionID, &a.SubmittedAt, &a.UpdatedAt)
	return &a, err
}

func (r *Repository) Create(ctx context.Context, userID string, input models.ApplicationInput) (*models.Application, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin application creation: %w", err)
	}
	defer tx.Rollback()
	var revisionID, participation string
	var teamMin, teamMax sql.NullInt64
	err = tx.QueryRowContext(ctx, `SELECT revision.case_revision_id,c.participation_mode,c.team_size_min,c.team_size_max FROM cases c JOIN case_revisions revision ON revision.case_id=c.case_id AND revision.version_no=c.terms_version WHERE c.case_id=$1 AND c.status IN ('published','in_progress') AND (c.application_deadline IS NULL OR c.application_deadline>CURRENT_TIMESTAMP) AND (c.capacity IS NULL OR (SELECT count(*) FROM executions e WHERE e.case_id=c.case_id AND e.status NOT IN ('closed','cancelled'))<c.capacity) FOR UPDATE OF c`, input.CaseID).Scan(&revisionID, &participation, &teamMin, &teamMax)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCaseUnavailable
	}
	if err != nil {
		return nil, fmt.Errorf("select application case: %w", err)
	}
	var studentID, teamID any
	status := "submitted"
	if input.ApplicantType == "individual" {
		if participation == "team" {
			return nil, ErrCaseUnavailable
		}
		studentID = userID
		teamID = nil
	} else {
		if participation == "individual" {
			return nil, ErrCaseUnavailable
		}
		var count int
		err = tx.QueryRowContext(ctx, `SELECT count(*) FROM teams t JOIN team_members m ON m.team_id=t.team_id AND m.left_at IS NULL WHERE t.team_id=$1 AND t.leader_id=$2 AND t.status='active'`, input.TeamID, userID).Scan(&count)
		if err != nil {
			return nil, fmt.Errorf("validate application team: %w", err)
		}
		if count == 0 || (teamMin.Valid && int64(count) < teamMin.Int64) || (teamMax.Valid && int64(count) > teamMax.Int64) {
			return nil, ErrForbidden
		}
		teamID = input.TeamID
		studentID = nil
		if count > 1 {
			status = "consent_pending"
		}
	}
	if input.ResumeFileID != "" {
		var exists bool
		if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM files WHERE file_id=$1 AND uploaded_by=$2 AND status='active')`, input.ResumeFileID, userID).Scan(&exists); err != nil || !exists {
			return nil, ErrForbidden
		}
	}
	var applicationID string
	err = tx.QueryRowContext(ctx, `INSERT INTO applications(case_id,case_revision_id,submitted_by,student_id,team_id,cover_letter,resume_file_id,portfolio_url,github_url,status) VALUES($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,'')::uuid,NULLIF($8,''),NULLIF($9,''),$10) RETURNING application_id`, input.CaseID, revisionID, userID, studentID, teamID, input.CoverLetter, input.ResumeFileID, input.PortfolioURL, input.GithubURL, status).Scan(&applicationID)
	if err != nil {
		return nil, fmt.Errorf("create application: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO application_consents(application_id,student_id,case_revision_id) VALUES($1,$2,$3)`, applicationID, userID, revisionID); err != nil {
		return nil, fmt.Errorf("record application consent: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit application creation: %w", err)
	}
	return r.Get(ctx, userID, applicationID, false, false)
}

func (r *Repository) Get(ctx context.Context, userID, applicationID string, isCompany, isAdmin bool) (*models.Application, error) {
	item, err := scanApplication(r.db.QueryRowContext(ctx, applicationSelect+` WHERE a.application_id=$1 AND ($4 OR a.student_id=$2 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=a.team_id AND tm.student_id=$2 AND tm.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')))`, applicationID, userID, isCompany, isAdmin))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("get application: %w", err)
	}
	return item, nil
}

func (r *Repository) List(ctx context.Context, userID string, isCompany, isAdmin bool, filter models.ApplicationListFilter, limit int, before *time.Time, beforeID string) ([]models.Application, error) {
	query := applicationSelect + ` WHERE ($1 OR (($2 OR NOT $3) AND (a.student_id=$4 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=a.team_id AND tm.student_id=$4 AND tm.left_at IS NULL))) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$4 AND cm.status='active' AND cm.permissions ? 'manage_company')))`
	args := []any{isAdmin, filter.Mine, isCompany, userID}
	if filter.CaseID != "" {
		args = append(args, filter.CaseID)
		query += fmt.Sprintf(" AND a.case_id=$%d", len(args))
	}
	if filter.Status != "" {
		args = append(args, filter.Status)
		query += fmt.Sprintf(" AND a.status=$%d", len(args))
	}
	if before != nil {
		args = append(args, *before, beforeID)
		query += fmt.Sprintf(" AND (a.submitted_at,a.application_id)<($%d,$%d)", len(args)-1, len(args))
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY a.submitted_at DESC,a.application_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list applications: %w", err)
	}
	defer rows.Close()
	items := make([]models.Application, 0)
	for rows.Next() {
		item, err := scanApplication(rows)
		if err != nil {
			return nil, fmt.Errorf("scan application: %w", err)
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) Consent(ctx context.Context, userID, applicationID string) (*models.Application, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin application consent: %w", err)
	}
	defer tx.Rollback()
	var teamID sql.NullString
	var revisionID, status string
	err = tx.QueryRowContext(ctx, `SELECT team_id,case_revision_id,status FROM applications WHERE application_id=$1 FOR UPDATE`, applicationID).Scan(&teamID, &revisionID, &status)
	if err != nil {
		return nil, ErrForbidden
	}
	if !teamID.Valid || status != "consent_pending" {
		return nil, ErrInvalidTransition
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO application_consents(application_id,student_id,case_revision_id) SELECT $1,m.student_id,$3 FROM team_members m WHERE m.team_id=$2 AND m.student_id=$4 AND m.left_at IS NULL ON CONFLICT DO NOTHING`, applicationID, teamID.String, revisionID, userID)
	if err != nil {
		return nil, fmt.Errorf("accept application terms: %w", err)
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		return nil, ErrForbidden
	}
	_, err = tx.ExecContext(ctx, `UPDATE applications a SET status='submitted' WHERE a.application_id=$1 AND NOT EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=a.team_id AND m.left_at IS NULL AND NOT EXISTS(SELECT 1 FROM application_consents x WHERE x.application_id=a.application_id AND x.student_id=m.student_id AND x.case_revision_id=a.case_revision_id))`, applicationID)
	if err != nil {
		return nil, fmt.Errorf("complete application consents: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit application consent: %w", err)
	}
	return r.Get(ctx, userID, applicationID, false, false)
}

func (r *Repository) SetStatus(ctx context.Context, userID, applicationID, status, notes string, companyActor bool) (*models.Application, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin application transition: %w", err)
	}
	defer tx.Rollback()
	var current, caseID string
	var teamID sql.NullString
	if companyActor {
		err = tx.QueryRowContext(ctx, `SELECT a.status,a.case_id,a.team_id FROM applications a JOIN cases c ON c.case_id=a.case_id WHERE a.application_id=$1 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') FOR UPDATE OF a`, applicationID, userID).Scan(&current, &caseID, &teamID)
	} else {
		err = tx.QueryRowContext(ctx, `SELECT a.status,a.case_id,a.team_id FROM applications a WHERE a.application_id=$1 AND (a.student_id=$2 OR EXISTS(SELECT 1 FROM teams t WHERE t.team_id=a.team_id AND t.leader_id=$2 AND t.status='active')) FOR UPDATE`, applicationID, userID).Scan(&current, &caseID, &teamID)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("authorize application transition: %w", err)
	}
	allowed := false
	if !companyActor {
		allowed = status == "withdrawn" && (current == "consent_pending" || current == "submitted" || current == "info_requested" || current == "interview")
	} else {
		switch status {
		case "info_requested", "interview", "rejected":
			allowed = current == "submitted" || current == "info_requested" || current == "interview"
		case "accepted":
			allowed = current == "submitted" || current == "interview"
		}
	}
	if !allowed {
		return nil, ErrInvalidTransition
	}
	if status == "accepted" {
		var capacity, teamMinimum, teamMaximum sql.NullInt64
		if err = tx.QueryRowContext(ctx, `SELECT capacity,team_size_min,team_size_max FROM cases WHERE case_id=$1 FOR UPDATE`, caseID).Scan(&capacity, &teamMinimum, &teamMaximum); err != nil {
			return nil, fmt.Errorf("lock application case: %w", err)
		}
		var activeExecutions int
		if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM executions WHERE case_id=$1 AND status NOT IN ('closed','cancelled')`, caseID).Scan(&activeExecutions); err != nil {
			return nil, fmt.Errorf("count case executions: %w", err)
		}
		if capacity.Valid && int64(activeExecutions) >= capacity.Int64 {
			return nil, ErrCaseUnavailable
		}
		if teamID.Valid {
			var members int
			if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM team_members WHERE team_id=$1 AND left_at IS NULL`, teamID.String).Scan(&members); err != nil {
				return nil, fmt.Errorf("count application team: %w", err)
			}
			if (teamMinimum.Valid && int64(members) < teamMinimum.Int64) || (teamMaximum.Valid && int64(members) > teamMaximum.Int64) {
				return nil, ErrCaseUnavailable
			}
		}
		var missing bool
		if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM applications a LEFT JOIN team_members m ON m.team_id=a.team_id AND m.left_at IS NULL WHERE a.application_id=$1 AND ((a.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM application_consents x WHERE x.application_id=a.application_id AND x.student_id=a.student_id)) OR (m.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM application_consents x WHERE x.application_id=a.application_id AND x.student_id=m.student_id))))`, applicationID).Scan(&missing); err != nil {
			return nil, fmt.Errorf("check application consents: %w", err)
		}
		if missing {
			return nil, ErrConsentPending
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE applications SET status=$2,company_notes=NULLIF($3,'') WHERE application_id=$1`, applicationID, status, notes); err != nil {
		return nil, fmt.Errorf("update application status: %w", err)
	}
	if status == "accepted" {
		var executionID string
		err = tx.QueryRowContext(ctx, `INSERT INTO executions(case_id,application_id,team_id,due_at) SELECT a.case_id,a.application_id,a.team_id,c.due_at FROM applications a JOIN cases c ON c.case_id=a.case_id WHERE a.application_id=$1 RETURNING execution_id`, applicationID).Scan(&executionID)
		if err != nil {
			return nil, fmt.Errorf("create execution: %w", err)
		}
		if teamID.Valid {
			_, err = tx.ExecContext(ctx, `INSERT INTO execution_members(execution_id,student_id,role_id) SELECT $1,m.student_id,m.role_id FROM team_members m WHERE m.team_id=$2 AND m.left_at IS NULL`, executionID, teamID.String)
		} else {
			_, err = tx.ExecContext(ctx, `INSERT INTO execution_members(execution_id,student_id) SELECT $1,student_id FROM applications WHERE application_id=$2`, executionID, applicationID)
		}
		if err != nil {
			return nil, fmt.Errorf("create execution members: %w", err)
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO execution_stages(execution_id,stage_id) SELECT $1,stage_id FROM case_stages WHERE case_id=$2`, executionID, caseID); err != nil {
			return nil, fmt.Errorf("initialize execution stages: %w", err)
		}
		if _, err = tx.ExecContext(ctx, `UPDATE cases SET status='in_progress' WHERE case_id=$1 AND status='published'`, caseID); err != nil {
			return nil, fmt.Errorf("activate case: %w", err)
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit application transition: %w", err)
	}
	return r.Get(ctx, userID, applicationID, companyActor, false)
}

const executionSelect = `SELECT e.execution_id,e.case_id,c.title,e.application_id,e.team_id,e.status,e.started_at,e.due_at,e.ended_at,e.created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id',m.student_id,'name',concat_ws(' ',s.last_name,s.first_name,s.patronymic),'role_id',m.role_id,'role_name',COALESCE(r.name,''),'joined_at',m.joined_at,'left_at',m.left_at) ORDER BY m.joined_at,m.student_id) FROM execution_members m JOIN students s ON s.user_id=m.student_id LEFT JOIN team_roles r ON r.team_role_id=m.role_id WHERE m.execution_id=e.execution_id),'[]'::jsonb) FROM executions e JOIN cases c ON c.case_id=e.case_id`

func (r *Repository) GetExecution(ctx context.Context, userID, executionID string, isCompany, isAdmin bool) (*models.Execution, error) {
	var item models.Execution
	var members []byte
	err := r.db.QueryRowContext(ctx, executionSelect+` WHERE e.execution_id=$1 AND ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')))`, executionID, userID, isCompany, isAdmin).Scan(&item.ExecutionID, &item.CaseID, &item.CaseTitle, &item.ApplicationID, &item.TeamID, &item.Status, &item.StartedAt, &item.DueAt, &item.EndedAt, &item.CreatedAt, &members)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("get execution: %w", err)
	}
	if err = json.Unmarshal(members, &item.Members); err != nil {
		return nil, fmt.Errorf("decode execution members: %w", err)
	}
	return &item, nil
}
