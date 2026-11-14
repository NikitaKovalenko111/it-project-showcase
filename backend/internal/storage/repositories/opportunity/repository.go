package opportunity_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/internal/storage/audit"
)

var (
	ErrNotFound        = errors.New("opportunity not found")
	ErrForbidden       = errors.New("opportunity forbidden")
	ErrConflict        = errors.New("opportunity conflict")
	ErrCuratorAssigned = errors.New("student already has an active curator")
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db} }

func (r *Repository) ListOpenTeams(ctx context.Context, limit, offset int) ([]models.Team, int, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT t.team_id,t.name,t.leader_id,t.status,t.description,t.visibility,t.looking_for_members,t.created_at,t.updated_at FROM showcase.teams t WHERE t.status='active' AND t.visibility='open' AND t.looking_for_members ORDER BY t.updated_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	items := make([]models.Team, 0)
	for rows.Next() {
		var x models.Team
		x.Members = []models.TeamMember{}
		if e = rows.Scan(&x.TeamID, &x.Name, &x.LeaderID, &x.Status, &x.Description, &x.Visibility, &x.LookingForMembers, &x.CreatedAt, &x.UpdatedAt); e != nil {
			return nil, 0, e
		}
		items = append(items, x)
	}
	var total int
	e = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.teams WHERE status='active' AND visibility='open' AND looking_for_members`).Scan(&total)
	return items, total, e
}
func (r *Repository) UpdateTeamDiscovery(ctx context.Context, user, team, name, description, visibility string, looking bool) error {
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.teams SET name=$3,description=$4,visibility=$5,looking_for_members=$6 WHERE team_id=$1 AND leader_id=$2 AND status='active'`, team, user, name, description, visibility, looking)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrForbidden
	}
	return nil
}
func (r *Repository) ApplyTeam(ctx context.Context, user, team, role, resume, letter string) (*models.TeamJoinApplication, error) {
	var x models.TeamJoinApplication
	var roleArg, resumeArg any
	if role != "" {
		roleArg = role
	}
	if resume != "" {
		resumeArg = resume
	}
	e := r.db.QueryRowContext(ctx, `INSERT INTO showcase.team_join_applications(team_id,student_id,role_id,resume_file_id,cover_letter) SELECT t.team_id,$2,$3,$4,$5 FROM showcase.teams t WHERE t.team_id=$1 AND t.status='active' AND t.visibility='open' AND t.looking_for_members AND t.leader_id<>$2 AND NOT EXISTS(SELECT 1 FROM showcase.team_members m WHERE m.team_id=t.team_id AND m.student_id=$2 AND m.left_at IS NULL) AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM showcase.team_roles r WHERE r.team_role_id=$3 AND r.is_active)) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM showcase.files f WHERE f.file_id=$4 AND f.uploaded_by=$2 AND f.status='active')) RETURNING join_application_id,team_id,student_id,role_id,resume_file_id,cover_letter,status,created_at,responded_at`, team, user, roleArg, resumeArg, letter).Scan(&x.JoinApplicationID, &x.TeamID, &x.StudentID, &x.RoleID, &x.ResumeFileID, &x.CoverLetter, &x.Status, &x.CreatedAt, &x.RespondedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return &x, e
}

const teamApplicationsSelect = `SELECT a.join_application_id,a.team_id,a.student_id,concat_ws(' ',s.last_name,s.first_name),a.role_id,a.resume_file_id,a.cover_letter,a.status,a.created_at,a.responded_at FROM showcase.team_join_applications a JOIN showcase.teams t ON t.team_id=a.team_id JOIN showcase.students s ON s.user_id=a.student_id`

func (r *Repository) ListTeamApplications(ctx context.Context, user, team string) ([]models.TeamJoinApplication, error) {
	return r.listTeamApplications(ctx, ` WHERE a.team_id=$1 AND t.leader_id=$2 ORDER BY a.created_at DESC,a.join_application_id DESC`, team, user)
}

func (r *Repository) ListMyTeamApplications(ctx context.Context, user string, limit int, offset int64) ([]models.TeamJoinApplication, int, error) {
	items, err := r.listTeamApplications(ctx, ` WHERE a.student_id=$1 ORDER BY a.created_at DESC,a.join_application_id DESC LIMIT $2 OFFSET $3`, user, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.team_join_applications WHERE student_id=$1`, user).Scan(&total)
	return items, total, err
}

func (r *Repository) listTeamApplications(ctx context.Context, suffix string, args ...any) ([]models.TeamJoinApplication, error) {
	rows, e := r.db.QueryContext(ctx, teamApplicationsSelect+suffix, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	items := []models.TeamJoinApplication{}
	for rows.Next() {
		var x models.TeamJoinApplication
		if e = rows.Scan(&x.JoinApplicationID, &x.TeamID, &x.StudentID, &x.StudentName, &x.RoleID, &x.ResumeFileID, &x.CoverLetter, &x.Status, &x.CreatedAt, &x.RespondedAt); e != nil {
			return nil, e
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) RespondTeamApplication(ctx context.Context, user, id, status string) error {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var team, student string
	var role sql.NullString
	var current string
	e = tx.QueryRowContext(ctx, `SELECT a.team_id,a.student_id,a.role_id,a.status FROM showcase.team_join_applications a JOIN showcase.teams t ON t.team_id=a.team_id WHERE a.join_application_id=$1 AND t.leader_id=$2 FOR UPDATE`, id, user).Scan(&team, &student, &role, &current)
	if errors.Is(e, sql.ErrNoRows) {
		return ErrForbidden
	}
	if e != nil {
		return e
	}
	if current != "pending" {
		return ErrConflict
	}
	_, e = tx.ExecContext(ctx, `UPDATE showcase.team_join_applications SET status=$2,responded_at=CURRENT_TIMESTAMP WHERE join_application_id=$1`, id, status)
	if e != nil {
		return e
	}
	if status == "accepted" {
		_, e = tx.ExecContext(ctx, `INSERT INTO showcase.team_members(team_id,student_id,role_id) VALUES($1,$2,$3) ON CONFLICT(team_id,student_id) DO UPDATE SET role_id=EXCLUDED.role_id,left_at=NULL,joined_at=CURRENT_TIMESTAMP`, team, student, role)
		if e != nil {
			return e
		}
	}
	return tx.Commit()
}
func (r *Repository) UpsertTeamProfile(ctx context.Context, user, headline, description, resume string, visible bool) (*models.TeamSearchProfile, error) {
	var resumeArg any
	if resume != "" {
		resumeArg = resume
	}
	var x models.TeamSearchProfile
	e := r.db.QueryRowContext(ctx, `INSERT INTO showcase.student_team_search_profiles(student_id,headline,description,resume_file_id,is_visible) SELECT $1,$2,$3,$4,$5 WHERE $4::uuid IS NULL OR EXISTS(SELECT 1 FROM showcase.files f WHERE f.file_id=$4 AND f.uploaded_by=$1 AND f.status='active') ON CONFLICT(student_id) DO UPDATE SET headline=EXCLUDED.headline,description=EXCLUDED.description,resume_file_id=EXCLUDED.resume_file_id,is_visible=EXCLUDED.is_visible RETURNING student_id,headline,description,resume_file_id,is_visible,updated_at`, user, headline, description, resumeArg, visible).Scan(&x.StudentID, &x.Headline, &x.Description, &x.ResumeFileID, &x.IsVisible, &x.UpdatedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return &x, e
}
func (r *Repository) ListTeamProfiles(ctx context.Context, limit, offset int) ([]models.TeamSearchProfile, int, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT student_id,headline,description,resume_file_id,is_visible,updated_at FROM showcase.student_team_search_profiles WHERE is_visible ORDER BY updated_at DESC,student_id DESC LIMIT $1 OFFSET $2`, limit, offset)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	items := []models.TeamSearchProfile{}
	for rows.Next() {
		var x models.TeamSearchProfile
		if e = rows.Scan(&x.StudentID, &x.Headline, &x.Description, &x.ResumeFileID, &x.IsVisible, &x.UpdatedAt); e != nil {
			return nil, 0, e
		}
		items = append(items, x)
	}
	var total int
	e = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.student_team_search_profiles WHERE is_visible`).Scan(&total)
	return items, total, e
}

const internshipCols = `p.program_id,p.company_id,c.full_name,p.created_by,p.title,p.summary,p.content_markdown,p.status,COALESCE(p.moderation_comment,''),p.application_deadline,p.created_at,p.updated_at,p.published_at,p.capacity,p.kind,
	COALESCE((SELECT jsonb_agg(x.file_id ORDER BY x.file_id) FROM showcase.internship_files x WHERE x.program_id=p.program_id),'[]'::jsonb)`

func scanInternship(row interface{ Scan(...any) error }) (*models.InternshipProgram, error) {
	var x models.InternshipProgram
	var files []byte
	e := row.Scan(&x.ProgramID, &x.CompanyID, &x.CompanyName, &x.CreatedBy, &x.Title, &x.Summary, &x.ContentMarkdown, &x.Status, &x.ModerationComment, &x.ApplicationDeadline, &x.CreatedAt, &x.UpdatedAt, &x.PublishedAt, &x.Capacity, &x.Kind, &files)
	if e == nil {
		e = json.Unmarshal(files, &x.FileIDs)
	}
	return &x, e
}
func (r *Repository) CreateInternship(ctx context.Context, user string, in models.InternshipInput) (*models.InternshipProgram, error) {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	var id string
	e = tx.QueryRowContext(ctx, `INSERT INTO showcase.internship_programs(company_id,created_by,title,summary,content_markdown,application_deadline,capacity,kind) SELECT $2,$1,$3,$4,$5,$6,$7,$8 FROM showcase.company_members m WHERE m.user_id=$1 AND m.company_id=$2 AND m.status='active' AND m.permissions ? 'manage_company' RETURNING program_id`, user, in.CompanyID, in.Title, in.Summary, in.ContentMarkdown, in.ApplicationDeadline, in.Capacity, in.Kind).Scan(&id)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if e != nil {
		return nil, e
	}
	if e = saveProgramFiles(ctx, tx, id, user, in.FileIDs); e != nil {
		return nil, e
	}
	item, e := scanInternship(tx.QueryRowContext(ctx, `SELECT `+internshipCols+` FROM showcase.internship_programs p JOIN showcase.companies c USING(company_id) WHERE p.program_id=$1`, id))
	if e != nil {
		return nil, e
	}
	return item, tx.Commit()
}
func (r *Repository) GetInternship(ctx context.Context, id string, admin bool, user string) (*models.InternshipProgram, error) {
	x, e := scanInternship(r.db.QueryRowContext(ctx, `SELECT `+internshipCols+` FROM showcase.internship_programs p JOIN showcase.companies c ON c.company_id=p.company_id
		WHERE p.program_id=$1 AND showcase.can_read_program(p.program_id,NULLIF($3,'')::uuid,$2)`, id, admin, user))
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return x, e
}
func (r *Repository) ListInternships(ctx context.Context, status, owner string, limit, offset int) ([]models.InternshipProgram, int, error) {
	const scope = ` WHERE
		(($2='' AND (p.status=$1 OR ($1='admin_review' AND p.status IN ('moderation','published','closed','hidden')))) OR EXISTS(
			SELECT 1 FROM showcase.company_members m
			WHERE m.company_id=p.company_id AND m.user_id=NULLIF($2,'')::uuid AND m.status='active'
			AND m.permissions ? 'manage_company'
		))`
	rows, e := r.db.QueryContext(ctx, `SELECT `+internshipCols+
		` FROM showcase.internship_programs p JOIN showcase.companies c ON c.company_id=p.company_id`+
		scope+
		` ORDER BY p.created_at DESC,p.program_id DESC LIMIT $3 OFFSET $4`, status, owner, limit, offset)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	items := []models.InternshipProgram{}
	for rows.Next() {
		x, e := scanInternship(rows)
		if e != nil {
			return nil, 0, e
		}
		items = append(items, *x)
	}
	if e = rows.Err(); e != nil {
		return nil, 0, e
	}
	var total int
	e = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.internship_programs p`+scope, status, owner).Scan(&total)
	return items, total, e
}

func (r *Repository) UpdateInternship(ctx context.Context, user, programID string, in models.InternshipInput) (*models.InternshipProgram, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	item, err := scanInternship(tx.QueryRowContext(ctx, `WITH updated AS (
		UPDATE showcase.internship_programs p
		SET title=$4,summary=$5,content_markdown=$6,application_deadline=$7,capacity=COALESCE($8,p.capacity),
			status=CASE WHEN p.status='published' THEN 'revision' ELSE p.status END
		WHERE p.program_id=$1 AND p.company_id=$3 AND p.status IN ('draft','revision','published') AND ($9='' OR p.kind=$9)
			AND ($8::int IS NULL OR $8 >= (SELECT count(*) FROM showcase.internship_applications a WHERE a.program_id=p.program_id AND a.status='accepted'))
			AND EXISTS(SELECT 1 FROM showcase.company_members m WHERE m.company_id=p.company_id
				AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company')
		RETURNING p.*
	) SELECT `+internshipCols+` FROM updated p JOIN showcase.companies c ON c.company_id=p.company_id`,
		programID, user, in.CompanyID, in.Title, in.Summary, in.ContentMarkdown, in.ApplicationDeadline, in.Capacity, in.Kind))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	if err = saveProgramFiles(ctx, tx, programID, user, in.FileIDs); err != nil {
		return nil, err
	}
	if in.FileIDs != nil {
		item.FileIDs = in.FileIDs
	}
	return item, tx.Commit()
}

func saveProgramFiles(ctx context.Context, tx *sql.Tx, program, user string, ids []string) error {
	if ids == nil {
		return nil
	}
	for _, id := range ids {
		var attached string
		err := tx.QueryRowContext(ctx, `SELECT f.file_id FROM showcase.files f WHERE f.file_id=$1 AND f.status='active'
			AND (f.uploaded_by=$2 OR EXISTS(SELECT 1 FROM showcase.internship_files x WHERE x.program_id=$3 AND x.file_id=f.file_id))`, id, user, program).Scan(&attached)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrForbidden
		}
		if err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM showcase.internship_files WHERE program_id=$1`, program); err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := tx.ExecContext(ctx, `INSERT INTO showcase.internship_files(program_id,file_id) VALUES($1,$2)`, program, id); err != nil {
			return err
		}
	}
	return nil
}
func (r *Repository) UpdateInternshipStatus(ctx context.Context, user, id, status, comment string, admin bool) (*models.InternshipProgram, error) {
	return r.UpdateInternshipStatusByRole(ctx, user, id, status, comment, admin, false)
}

func (r *Repository) UpdateInternshipStatusByRole(ctx context.Context, user, id, status, comment string, admin, curator bool) (*models.InternshipProgram, error) {
	item, e := scanInternship(r.db.QueryRowContext(ctx, `WITH updated AS (
		UPDATE showcase.internship_programs p SET status=$3,
		moderation_comment=CASE WHEN $3='draft' THEN p.moderation_comment ELSE NULLIF($4,'') END,
		published_at=CASE WHEN $3='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END
		WHERE p.program_id=$1 AND (
			(($5 OR $6) AND p.status='moderation' AND $3 IN ('published','revision'))
			OR ($5 AND p.status IN ('published','closed') AND $3='hidden')
			OR (EXISTS(SELECT 1 FROM showcase.company_members m WHERE m.company_id=p.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company')
				AND ((p.status IN ('draft','revision') AND $3='moderation') OR (p.status='published' AND $3='closed')
					OR (p.status='moderation' AND $3='draft'))))
		RETURNING p.*
	) SELECT `+internshipCols+` FROM updated p JOIN showcase.companies c ON c.company_id=p.company_id`, id, user, status, comment, admin, curator))
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return item, e
}

func (r *Repository) Leaderboard(ctx context.Context, caseID, user string, admin bool) ([]models.LeaderboardEntry, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT p.place_no,COALESCE(p.nomination,''),e.execution_id,e.team_id,
		COALESCE(NULLIF(t.name,''),NULLIF(concat_ws(' ',student.last_name,student.first_name),''),u.username,''),
		COALESCE(scores.total,0),COALESCE(scores.maximum,0),
		CASE WHEN scores.maximum>0 THEN round(scores.total/scores.maximum*100,2) ELSE 0 END AS percentage,
		CASE WHEN scores.maximum>0 THEN 'published' ELSE 'not_evaluated' END
		FROM executions e JOIN cases c ON c.case_id=e.case_id
		LEFT JOIN teams t ON t.team_id=e.team_id
		JOIN applications a ON a.application_id=e.application_id
        LEFT JOIN users u ON u.user_id=a.submitted_by
		LEFT JOIN students student ON student.user_id=u.user_id
		LEFT JOIN LATERAL (
			(SELECT ev.total_score AS total,ev.max_score AS maximum FROM submissions s JOIN evaluations ev ON ev.submission_id=s.submission_id
			WHERE c.event_format<>'olympiad' AND s.execution_id=e.execution_id AND s.kind='final' AND s.status<>'superseded' AND ev.status='published'
			ORDER BY ev.published_at DESC LIMIT 1)
			UNION ALL
			SELECT sum(rs.total_score),sum(rs.max_score) FROM event_round_submissions rs
			WHERE c.event_format='olympiad' AND rs.execution_id=e.execution_id GROUP BY rs.execution_id
		) scores ON TRUE
		LEFT JOIN case_placements p ON p.case_id=e.case_id AND p.execution_id=e.execution_id
		WHERE e.case_id=$1 AND e.status<>'cancelled' AND ($3 OR EXISTS(SELECT 1 FROM company_members m
			WHERE m.company_id=c.company_id AND m.user_id=NULLIF($2,'')::uuid AND m.status='active' AND m.permissions ? 'manage_company')
			OR (p.execution_id IS NOT NULL AND c.visibility='public' AND c.status IN ('published','in_progress','completed'))
			OR (p.execution_id IS NOT NULL AND EXISTS(SELECT 1 FROM execution_members em JOIN executions ex ON ex.execution_id=em.execution_id
				WHERE ex.case_id=c.case_id AND em.student_id=NULLIF($2,'')::uuid AND em.left_at IS NULL)))
		ORDER BY p.place_no NULLS LAST,CASE WHEN c.event_format='olympiad' THEN COALESCE(scores.total,0) ELSE 0 END DESC,percentage DESC,e.execution_id`, caseID, user, admin)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	items := []models.LeaderboardEntry{}
	for rows.Next() {
		var x models.LeaderboardEntry
		if e = rows.Scan(&x.PlaceNo, &x.Nomination, &x.ExecutionID, &x.TeamID, &x.TeamName, &x.TotalScore, &x.MaxScore, &x.Percentage, &x.EvaluationStatus); e != nil {
			return nil, e
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) SetPlacements(ctx context.Context, user, caseID string, items []models.PlacementInput) error {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if e = lockPlacementManager(ctx, tx, user, caseID); e != nil {
		return e
	}
	var ready bool
	e = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.executions WHERE case_id=$1 AND status<>'cancelled')
		AND CASE WHEN (SELECT event_format FROM showcase.cases WHERE case_id=$1)='olympiad'
			THEN EXISTS(SELECT 1 FROM event_round_submissions rs JOIN executions e ON e.execution_id=rs.execution_id WHERE e.case_id=$1 AND e.status<>'cancelled' AND rs.total_score IS NOT NULL)
				AND NOT EXISTS(SELECT 1 FROM event_round_submissions rs JOIN executions e ON e.execution_id=rs.execution_id WHERE e.case_id=$1 AND e.status<>'cancelled' AND rs.total_score IS NULL)
			ELSE NOT EXISTS(SELECT 1 FROM showcase.executions e WHERE e.case_id=$1 AND e.status<>'cancelled' AND NOT EXISTS(
				SELECT 1 FROM showcase.submissions s JOIN showcase.evaluations v ON v.submission_id=s.submission_id
				WHERE s.execution_id=e.execution_id AND s.kind='final' AND s.status<>'superseded' AND v.status='published')) END`, caseID).Scan(&ready)
	if e != nil {
		return e
	}
	if !ready {
		return ErrConflict
	}
	for _, item := range items {
		var eligible bool
		e = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM executions x JOIN cases c ON c.case_id=x.case_id
			WHERE x.case_id=$1 AND x.execution_id=$2 AND x.status<>'cancelled'
			AND CASE WHEN c.event_format='olympiad' THEN EXISTS(SELECT 1 FROM event_round_submissions rs
				WHERE rs.execution_id=x.execution_id AND rs.total_score IS NOT NULL)
			ELSE EXISTS(SELECT 1 FROM submissions s JOIN evaluations v ON v.submission_id=s.submission_id
				WHERE s.execution_id=x.execution_id AND s.kind='final' AND s.status<>'superseded' AND v.status='published') END)`,
			caseID, item.ExecutionID).Scan(&eligible)
		if e != nil {
			return e
		}
		if !eligible {
			return ErrConflict
		}
	}
	if _, e = tx.ExecContext(ctx, `DELETE FROM showcase.case_placements WHERE case_id=$1`, caseID); e != nil {
		return e
	}
	for _, x := range items {
		if _, e = tx.ExecContext(ctx, `INSERT INTO showcase.case_placements(case_id,execution_id,place_no,nomination,assigned_by) VALUES($1,$2,$3,NULLIF($4,''),$5)`, caseID, x.ExecutionID, x.PlaceNo, x.Nomination, user); e != nil {
			return fmt.Errorf("save placement: %w", e)
		}
	}
	return tx.Commit()
}

func lockPlacementManager(ctx context.Context, tx *sql.Tx, user, caseID string) error {
	var allowed bool
	e := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.cases c LEFT JOIN showcase.company_members m ON m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company' WHERE c.case_id=$1 AND (m.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM showcase.user_roles ur JOIN showcase.roles r ON r.role_id=ur.role_id WHERE ur.user_id=$2 AND r.code='admin')) FOR UPDATE OF c)`, caseID, user).Scan(&allowed)
	if e != nil || !allowed {
		return ErrForbidden
	}
	return nil
}

func (r *Repository) WithdrawPlacements(ctx context.Context, user, caseID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockPlacementManager(ctx, tx, user, caseID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM case_placements WHERE case_id=$1`, caseID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) SetCurator(ctx context.Context, admin, student, curator string) (*models.CuratorAssignment, error) {
	return r.assignCurator(ctx, admin, student, curator, true)
}

func (r *Repository) AssignSelfCurator(ctx context.Context, curator, student string) (*models.CuratorAssignment, error) {
	return r.assignCurator(ctx, curator, student, curator, false)
}

func (r *Repository) assignCurator(ctx context.Context, actor, student, curator string, replace bool) (*models.CuratorAssignment, error) {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	// Serialize moderator changes and self-assignments for the same student.
	var studentID string
	e = tx.QueryRowContext(ctx, `SELECT s.user_id FROM showcase.students s
		JOIN showcase.users u ON u.user_id=s.user_id
		WHERE s.user_id=$1 AND u.status='active' FOR NO KEY UPDATE OF s`, student).Scan(&studentID)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if e != nil {
		return nil, e
	}
	var curatorID string
	e = tx.QueryRowContext(ctx, `SELECT u.user_id FROM showcase.users u
		JOIN showcase.user_roles ur ON ur.user_id=u.user_id
		JOIN showcase.roles r ON r.role_id=ur.role_id
		WHERE u.user_id=$1 AND u.status='active' AND r.code='university_staff'`, curator).Scan(&curatorID)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if e != nil {
		return nil, e
	}
	current, e := getCurator(ctx, tx, studentID, true)
	if e == nil {
		if current.CuratorID == curatorID {
			return current, tx.Commit()
		}
		if !replace {
			return nil, ErrCuratorAssigned
		}
		if _, e = tx.ExecContext(ctx, `UPDATE showcase.student_curators SET revoked_at=clock_timestamp() WHERE student_id=$1 AND revoked_at IS NULL`, studentID); e != nil {
			return nil, e
		}
	} else if !errors.Is(e, ErrNotFound) {
		return nil, e
	}
	if _, e = tx.ExecContext(ctx, `INSERT INTO showcase.student_curators(student_id,curator_id,assigned_by,assigned_at) VALUES ($1,$2,$3,clock_timestamp())`, studentID, curatorID, actor); e != nil {
		return nil, e
	}
	item, e := getCurator(ctx, tx, studentID, false)
	if e != nil {
		return nil, e
	}
	if e = tx.Commit(); e != nil {
		return nil, e
	}
	return item, nil
}
func (r *Repository) GetCurator(ctx context.Context, student string) (*models.CuratorAssignment, error) {
	return getCurator(ctx, r.db, student, false)
}

func getCurator(ctx context.Context, db interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, student string, lock bool) (*models.CuratorAssignment, error) {
	var x models.CuratorAssignment
	query := `SELECT sc.student_id,sc.curator_id,COALESCE(NULLIF(concat_ws(' ',s.last_name,s.first_name),''),u.username),sc.assigned_by,sc.assigned_at FROM showcase.student_curators sc JOIN showcase.users u ON u.user_id=sc.curator_id LEFT JOIN showcase.students s ON s.user_id=sc.curator_id WHERE sc.student_id=$1 AND sc.revoked_at IS NULL`
	if lock {
		query += " FOR UPDATE OF sc"
	}
	e := db.QueryRowContext(ctx, query, student).Scan(&x.StudentID, &x.CuratorID, &x.CuratorName, &x.AssignedBy, &x.AssignedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &x, e
}
func (r *Repository) RevokeCurator(ctx context.Context, student string) error {
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.student_curators SET revoked_at=clock_timestamp() WHERE student_id=$1 AND revoked_at IS NULL`, student)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) AttachPortfolioFile(ctx context.Context, user, file, kind, visibility string, def bool) (*models.PortfolioFile, error) {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	if def {
		_, e = tx.ExecContext(ctx, `UPDATE showcase.student_profile_files SET is_default=FALSE, visibility=CASE WHEN kind='resume' THEN 'private' ELSE visibility END WHERE student_id=$1 AND kind=$2 AND detached_at IS NULL`, user, kind)
		if e != nil {
			return nil, e
		}
	}
	res, e := tx.ExecContext(ctx, `INSERT INTO showcase.student_profile_files(student_id,file_id,kind,is_default,visibility) SELECT $1,f.file_id,$3,$4,$5 FROM showcase.files f WHERE f.file_id=$2 AND f.uploaded_by=$1 AND f.status='active' ON CONFLICT(student_id,file_id) DO UPDATE SET kind=EXCLUDED.kind,is_default=EXCLUDED.is_default,visibility=EXCLUDED.visibility,detached_at=NULL`, user, file, kind, def, visibility)
	if e != nil {
		return nil, e
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	if e = tx.Commit(); e != nil {
		return nil, e
	}
	items, e := r.ListPortfolioFiles(ctx, user, false)
	if e != nil {
		return nil, e
	}
	for _, x := range items {
		if x.FileID == file {
			return &x, nil
		}
	}
	return nil, ErrNotFound
}
func (r *Repository) ListPortfolioFiles(ctx context.Context, student string, public bool) ([]models.PortfolioFile, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT pf.file_id,pf.kind,pf.is_default,pf.visibility,f.original_name,f.mime_type,f.size_bytes,pf.created_at FROM showcase.student_profile_files pf JOIN showcase.files f ON f.file_id=pf.file_id WHERE pf.student_id=$1 AND pf.detached_at IS NULL AND f.status='active' AND ($2=FALSE OR pf.visibility='public') ORDER BY pf.kind,pf.is_default DESC,pf.created_at DESC`, student, public)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	items := []models.PortfolioFile{}
	for rows.Next() {
		var x models.PortfolioFile
		if e = rows.Scan(&x.FileID, &x.Kind, &x.IsDefault, &x.Visibility, &x.OriginalName, &x.MimeType, &x.SizeBytes, &x.CreatedAt); e != nil {
			return nil, e
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) DetachPortfolioFile(ctx context.Context, user, file string) error {
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.student_profile_files SET detached_at=CURRENT_TIMESTAMP,is_default=FALSE WHERE student_id=$1 AND file_id=$2 AND detached_at IS NULL`, user, file)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
func (r *Repository) ApplicationDefaults(ctx context.Context, user string) (*models.ApplicationDefaults, error) {
	x := &models.ApplicationDefaults{PortfolioFileIDs: []string{}}
	var resume sql.NullString
	e := r.db.QueryRowContext(ctx, `SELECT COALESCE((SELECT link->>'url' FROM showcase.students s CROSS JOIN LATERAL jsonb_array_elements(s.links) link WHERE s.user_id=$1 AND link->>'kind'='github' LIMIT 1),''),(SELECT file_id FROM showcase.student_profile_files WHERE student_id=$1 AND kind='resume' AND is_default AND detached_at IS NULL LIMIT 1)`, user).Scan(&x.GithubURL, &resume)
	if e != nil {
		return nil, e
	}
	if resume.Valid {
		x.ResumeFileID = &resume.String
	}
	rows, e := r.db.QueryContext(ctx, `SELECT file_id FROM showcase.student_profile_files WHERE student_id=$1 AND kind='portfolio' AND detached_at IS NULL ORDER BY is_default DESC,created_at DESC`, user)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		rows.Scan(&id)
		x.PortfolioFileIDs = append(x.PortfolioFileIDs, id)
	}
	return x, rows.Err()
}
func (r *Repository) Rating(ctx context.Context, student string) (*models.StudentRating, error) {
	x := &models.StudentRating{StudentID: student}
	e := r.db.QueryRowContext(ctx, `SELECT quality_score,completion_score,project_score,achievement_score,quality_score+completion_score+project_score+achievement_score FROM showcase.student_ratings WHERE student_id=$1`, student).Scan(&x.QualityScore, &x.CompletionScore, &x.ProjectScore, &x.AchievementScore, &x.Rating)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return x, e
}

func (r *Repository) CreateNDAVersion(ctx context.Context, user, caseID, text, file string) (*models.NDAVersion, error) {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	var allowed bool
	e = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.cases c JOIN showcase.company_members m ON m.company_id=c.company_id WHERE c.case_id=$1 AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company' AND c.status='draft')`, caseID, user).Scan(&allowed)
	if e != nil || !allowed {
		return nil, ErrForbidden
	}
	_, e = tx.ExecContext(ctx, `UPDATE showcase.case_nda_versions SET is_current=FALSE WHERE case_id=$1 AND is_current`, caseID)
	if e != nil {
		return nil, e
	}
	var fileArg any
	if file != "" {
		fileArg = file
		var owned bool
		if e = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.files WHERE file_id=$1 AND uploaded_by=$2 AND status='active')`, file, user).Scan(&owned); e != nil {
			return nil, e
		}
		if !owned {
			return nil, ErrForbidden
		}
	}
	var id string
	e = tx.QueryRowContext(ctx, `INSERT INTO showcase.case_nda_versions(case_id,version_no,text,file_id,created_by) VALUES($1,COALESCE((SELECT max(version_no)+1 FROM showcase.case_nda_versions WHERE case_id=$1),1),$2,$3,$4) RETURNING nda_version_id`, caseID, text, fileArg, user).Scan(&id)
	if e != nil {
		return nil, e
	}
	if e = tx.Commit(); e != nil {
		return nil, e
	}
	return r.getCurrentNDA(ctx, caseID, false)
}
func (r *Repository) GetCurrentNDA(ctx context.Context, caseID string) (*models.NDAVersion, error) {
	return r.getCurrentNDA(ctx, caseID, true)
}
func (r *Repository) getCurrentNDA(ctx context.Context, caseID string, public bool) (*models.NDAVersion, error) {
	var x models.NDAVersion
	e := r.db.QueryRowContext(ctx, `SELECT v.nda_version_id,v.case_id,v.version_no,v.text,v.file_id,v.created_by,v.created_at,v.is_current FROM showcase.case_nda_versions v JOIN showcase.cases c ON c.case_id=v.case_id WHERE v.case_id=$1 AND v.is_current AND (NOT $2 OR (c.status IN ('published','in_progress','completed') AND c.visibility='public'))`, caseID, public).Scan(&x.NDAVersionID, &x.CaseID, &x.VersionNo, &x.Text, &x.FileID, &x.CreatedBy, &x.CreatedAt, &x.IsCurrent)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &x, e
}
func (r *Repository) AcceptNDA(ctx context.Context, user, caseID, versionID string) error {
	res, e := r.db.ExecContext(ctx, `INSERT INTO showcase.nda_grants(case_id,student_id,status,nda_version_id,accepted_at) SELECT v.case_id,$2,'pending',v.nda_version_id,CURRENT_TIMESTAMP FROM showcase.case_nda_versions v JOIN showcase.cases c ON c.case_id=v.case_id WHERE v.case_id=$1 AND v.nda_version_id=$3 AND v.is_current AND c.nda_required AND c.status IN ('published','in_progress') ON CONFLICT DO NOTHING`, caseID, user, versionID)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrConflict
	}
	return nil
}
func (r *Repository) SetCaseCover(ctx context.Context, user, caseID, fileID string) error {
	res, e := audit.Exec(ctx, r.db, `UPDATE showcase.cases c SET cover_file_id=$3 WHERE c.case_id=$1 AND c.status IN ('draft','revision') AND EXISTS(SELECT 1 FROM showcase.company_members m WHERE m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company') AND EXISTS(SELECT 1 FROM showcase.files f WHERE f.file_id=$3 AND f.uploaded_by=$2 AND f.status='active' AND f.mime_type LIKE 'image/%')`, caseID, user, fileID)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrForbidden
	}
	return nil
}
