package opportunity_repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"
)

var (
	ErrNotFound  = errors.New("opportunity not found")
	ErrForbidden = errors.New("opportunity forbidden")
	ErrConflict  = errors.New("opportunity conflict")
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
func (r *Repository) ListTeamApplications(ctx context.Context, user, team string) ([]models.TeamJoinApplication, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT a.join_application_id,a.team_id,a.student_id,concat_ws(' ',s.last_name,s.first_name),a.role_id,a.resume_file_id,a.cover_letter,a.status,a.created_at,a.responded_at FROM showcase.team_join_applications a JOIN showcase.teams t ON t.team_id=a.team_id JOIN showcase.students s ON s.user_id=a.student_id WHERE a.team_id=$1 AND t.leader_id=$2 ORDER BY a.created_at DESC`, team, user)
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

const internshipCols = `p.program_id,p.company_id,c.full_name,p.created_by,p.title,p.summary,p.content_markdown,p.status,COALESCE(p.moderation_comment,''),p.application_deadline,p.created_at,p.updated_at,p.published_at`

func scanInternship(row interface{ Scan(...any) error }) (*models.InternshipProgram, error) {
	var x models.InternshipProgram
	e := row.Scan(&x.ProgramID, &x.CompanyID, &x.CompanyName, &x.CreatedBy, &x.Title, &x.Summary, &x.ContentMarkdown, &x.Status, &x.ModerationComment, &x.ApplicationDeadline, &x.CreatedAt, &x.UpdatedAt, &x.PublishedAt)
	return &x, e
}
func (r *Repository) CreateInternship(ctx context.Context, user string, in models.InternshipInput) (*models.InternshipProgram, error) {
	var id string
	e := r.db.QueryRowContext(ctx, `INSERT INTO showcase.internship_programs(company_id,created_by,title,summary,content_markdown,application_deadline) SELECT $2,$1,$3,$4,$5,$6 FROM showcase.company_members m WHERE m.user_id=$1 AND m.company_id=$2 AND m.status='active' AND m.permissions ? 'manage_company' RETURNING program_id`, user, in.CompanyID, in.Title, in.Summary, in.ContentMarkdown, in.ApplicationDeadline).Scan(&id)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if e != nil {
		return nil, e
	}
	return r.GetInternship(ctx, id, false, user)
}
func (r *Repository) GetInternship(ctx context.Context, id string, public bool, user string) (*models.InternshipProgram, error) {
	x, e := scanInternship(r.db.QueryRowContext(ctx, `SELECT `+internshipCols+` FROM showcase.internship_programs p JOIN showcase.companies c ON c.company_id=p.company_id WHERE p.program_id=$1 AND ($2 OR p.status='published' OR EXISTS(SELECT 1 FROM showcase.company_members m WHERE m.company_id=p.company_id AND m.user_id=$3 AND m.status='active'))`, id, public, user))
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return x, e
}
func (r *Repository) ListInternships(ctx context.Context, limit, offset int) ([]models.InternshipProgram, int, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT `+internshipCols+` FROM showcase.internship_programs p JOIN showcase.companies c ON c.company_id=p.company_id WHERE p.status='published' ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
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
	var total int
	e = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.internship_programs WHERE status='published'`).Scan(&total)
	return items, total, e
}
func (r *Repository) UpdateInternshipStatus(ctx context.Context, user, id, status, comment string, admin bool) (*models.InternshipProgram, error) {
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.internship_programs p SET status=$3,moderation_comment=NULLIF($4,''),published_at=CASE WHEN $3='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE p.program_id=$1 AND (($5 AND ((p.status='moderation' AND $3 IN ('published','revision')) OR (p.status='published' AND $3='hidden'))) OR (NOT $5 AND EXISTS(SELECT 1 FROM showcase.company_members m WHERE m.company_id=p.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company') AND ((p.status IN ('draft','revision') AND $3='moderation') OR (p.status='published' AND $3='closed'))))`, id, user, status, comment, admin)
	if e != nil {
		return nil, e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrForbidden
	}
	return r.GetInternship(ctx, id, admin, user)
}

func (r *Repository) Leaderboard(ctx context.Context, caseID string) ([]models.LeaderboardEntry, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT p.place_no,COALESCE(p.nomination,''),e.execution_id,e.team_id,COALESCE(t.name,''),COALESCE(v.total_score,0),COALESCE(v.max_score,0),CASE WHEN COALESCE(v.max_score,0)>0 THEN round(v.total_score/v.max_score*100,2) ELSE 0 END AS percentage,COALESCE(v.status,'not_evaluated') FROM showcase.executions e LEFT JOIN showcase.teams t ON t.team_id=e.team_id LEFT JOIN LATERAL(SELECT ev.total_score,ev.max_score,ev.status FROM showcase.submissions s JOIN showcase.evaluations ev ON ev.submission_id=s.submission_id WHERE s.execution_id=e.execution_id AND ev.status='published' ORDER BY ev.published_at DESC LIMIT 1)v ON TRUE LEFT JOIN showcase.case_placements p ON p.case_id=e.case_id AND p.execution_id=e.execution_id WHERE e.case_id=$1 AND e.status<>'cancelled' ORDER BY p.place_no NULLS LAST,percentage DESC,e.execution_id`, caseID)
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
	var allowed bool
	e = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.cases c LEFT JOIN showcase.company_members m ON m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company' WHERE c.case_id=$1 AND (m.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM showcase.user_roles ur JOIN showcase.roles r ON r.role_id=ur.role_id WHERE ur.user_id=$2 AND r.code='admin')))`, caseID, user).Scan(&allowed)
	if e != nil || !allowed {
		return ErrForbidden
	}
	var ready bool
	e = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.executions WHERE case_id=$1 AND status<>'cancelled') AND NOT EXISTS(SELECT 1 FROM showcase.executions e WHERE e.case_id=$1 AND e.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM showcase.submissions s JOIN showcase.evaluations v ON v.submission_id=s.submission_id AND v.status='published' WHERE s.execution_id=e.execution_id))`, caseID).Scan(&ready)
	if e != nil {
		return e
	}
	if !ready {
		return ErrConflict
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

func (r *Repository) SetCurator(ctx context.Context, admin, student, curator string) (*models.CuratorAssignment, error) {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	_, e = tx.ExecContext(ctx, `UPDATE showcase.student_curators SET revoked_at=CURRENT_TIMESTAMP WHERE student_id=$1 AND revoked_at IS NULL`, student)
	if e != nil {
		return nil, e
	}
	res, e := tx.ExecContext(ctx, `INSERT INTO showcase.student_curators(student_id,curator_id,assigned_by) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM showcase.user_roles ur JOIN showcase.roles r ON r.role_id=ur.role_id WHERE ur.user_id=$2 AND r.code IN ('university_staff','mentor','admin'))`, student, curator, admin)
	if e != nil {
		return nil, e
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrForbidden
	}
	if e = tx.Commit(); e != nil {
		return nil, e
	}
	return r.GetCurator(ctx, student)
}
func (r *Repository) GetCurator(ctx context.Context, student string) (*models.CuratorAssignment, error) {
	var x models.CuratorAssignment
	e := r.db.QueryRowContext(ctx, `SELECT sc.student_id,sc.curator_id,COALESCE(NULLIF(concat_ws(' ',s.last_name,s.first_name),''),u.username),sc.assigned_by,sc.assigned_at FROM showcase.student_curators sc JOIN showcase.users u ON u.user_id=sc.curator_id LEFT JOIN showcase.students s ON s.user_id=sc.curator_id WHERE sc.student_id=$1 AND sc.revoked_at IS NULL`, student).Scan(&x.StudentID, &x.CuratorID, &x.CuratorName, &x.AssignedBy, &x.AssignedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &x, e
}
func (r *Repository) RevokeCurator(ctx context.Context, student string) error {
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.student_curators SET revoked_at=CURRENT_TIMESTAMP WHERE student_id=$1 AND revoked_at IS NULL`, student)
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
		_, e = tx.ExecContext(ctx, `UPDATE showcase.student_profile_files SET is_default=FALSE WHERE student_id=$1 AND kind=$2 AND detached_at IS NULL`, user, kind)
		if e != nil {
			return nil, e
		}
	}
	_, e = tx.ExecContext(ctx, `INSERT INTO showcase.student_profile_files(student_id,file_id,kind,is_default,visibility) SELECT $1,f.file_id,$3,$4,$5 FROM showcase.files f WHERE f.file_id=$2 AND f.uploaded_by=$1 AND f.status='active' ON CONFLICT(student_id,file_id) DO UPDATE SET kind=EXCLUDED.kind,is_default=EXCLUDED.is_default,visibility=EXCLUDED.visibility,detached_at=NULL`, user, file, kind, def, visibility)
	if e != nil {
		return nil, e
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
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.cases c SET cover_file_id=$3 WHERE c.case_id=$1 AND c.status IN ('draft','revision') AND EXISTS(SELECT 1 FROM showcase.company_members m WHERE m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company') AND EXISTS(SELECT 1 FROM showcase.files f WHERE f.file_id=$3 AND f.uploaded_by=$2 AND f.status='active' AND f.mime_type LIKE 'image/%')`, caseID, user, fileID)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrForbidden
	}
	return nil
}
