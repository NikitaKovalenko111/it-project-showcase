package company_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"it-project-showcase/backend/internal/models"
)

type Repository struct{ db *sql.DB }

var ErrInvalidTransition = errors.New("invalid company transition")

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

func companyColumns() string {
	return `company_id, full_name, COALESCE(short_name, ''), COALESCE(industry, ''), COALESCE(description, ''), COALESCE(activities, ''), COALESCE(website, ''), COALESCE(contacts, ''), logo_file_id, status, created_at, updated_at`
}
func (r *Repository) Submit(ctx context.Context, userID, companyID string) (*models.Company, error) {
	company, err := scanCompany(r.db.QueryRowContext(ctx, `UPDATE companies c SET status='pending' WHERE c.company_id=$1 AND c.status IN ('draft','rejected') AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING `+companyColumns(), companyID, userID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sql.ErrNoRows
	}
	return company, err
}
func (r *Repository) InviteMember(ctx context.Context, userID, companyID, targetID, position string) (*models.CompanyMemberInvitation, error) {
	var x models.CompanyMemberInvitation
	var permissions []byte
	err := r.db.QueryRowContext(ctx, `INSERT INTO company_member_invitations(company_id,invited_by,user_id,position) SELECT c.company_id,$2,u.user_id,NULLIF($4,'') FROM companies c JOIN users u ON u.user_id=$3 AND u.status='active' WHERE c.company_id=$1 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') AND NOT EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active') RETURNING invitation_id,company_id,(SELECT full_name FROM companies WHERE company_id=$1),invited_by,user_id,COALESCE(position,''),permissions,status,created_at,responded_at`, companyID, userID, targetID, position).Scan(&x.InvitationID, &x.CompanyID, &x.CompanyName, &x.InvitedBy, &x.UserID, &x.Position, &permissions, &x.Status, &x.CreatedAt, &x.RespondedAt)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(permissions, &x.Permissions); err != nil {
		return nil, err
	}
	return &x, nil
}
func (r *Repository) RespondMemberInvitation(ctx context.Context, userID, id, status string) (*models.Company, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var companyID, position, current string
	var permissions []byte
	err = tx.QueryRowContext(ctx, `SELECT company_id,COALESCE(position,''),permissions,status FROM company_member_invitations WHERE invitation_id=$1 AND user_id=$2 FOR UPDATE`, id, userID).Scan(&companyID, &position, &permissions, &current)
	if err != nil {
		return nil, err
	}
	if current != "pending" {
		return nil, ErrInvalidTransition
	}
	_, err = tx.ExecContext(ctx, `UPDATE company_member_invitations SET status=$2,responded_at=CURRENT_TIMESTAMP WHERE invitation_id=$1`, id, status)
	if err != nil {
		return nil, err
	}
	if status == "accepted" {
		_, err = tx.ExecContext(ctx, `INSERT INTO company_members(company_id,user_id,position,permissions) VALUES($1,$2,NULLIF($3,''),$4) ON CONFLICT(company_id,user_id) DO UPDATE SET position=EXCLUDED.position,permissions=EXCLUDED.permissions,status='active'`, companyID, userID, position, permissions)
		if err != nil {
			return nil, err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='company_representative' ON CONFLICT DO NOTHING`, userID)
		if err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, companyID)
}
func (r *Repository) SendStudentInvitation(ctx context.Context, userID, companyID, studentID, caseID, kind, message string) (*models.CompanyInvitation, error) {
	var x models.CompanyInvitation
	err := r.db.QueryRowContext(ctx, `INSERT INTO company_invitations(company_id,student_id,case_id,kind,message,sent_by) SELECT c.company_id,s.user_id,NULLIF($4,'')::uuid,$5,NULLIF($6,''),$2 FROM companies c JOIN students s ON s.user_id=$3 WHERE c.company_id=$1 AND c.status='approved' AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') AND ($4='' OR EXISTS(SELECT 1 FROM cases x WHERE x.case_id=$4::uuid AND x.company_id=c.company_id AND x.status IN ('published','in_progress'))) RETURNING company_invitation_id,company_id,student_id,case_id,kind,status,COALESCE(message,''),sent_at,responded_at`, companyID, userID, studentID, caseID, kind, message).Scan(&x.InvitationID, &x.CompanyID, &x.StudentID, &x.CaseID, &x.Kind, &x.Status, &x.Message, &x.SentAt, &x.RespondedAt)
	return &x, err
}
func (r *Repository) RespondStudentInvitation(ctx context.Context, userID, id, status string) (*models.CompanyInvitation, error) {
	var x models.CompanyInvitation
	err := r.db.QueryRowContext(ctx, `UPDATE company_invitations SET status=$3,responded_at=CURRENT_TIMESTAMP WHERE company_invitation_id=$1 AND student_id=$2 AND status='sent' RETURNING company_invitation_id,company_id,student_id,case_id,kind,status,COALESCE(message,''),sent_at,responded_at`, id, userID, status).Scan(&x.InvitationID, &x.CompanyID, &x.StudentID, &x.CaseID, &x.Kind, &x.Status, &x.Message, &x.SentAt, &x.RespondedAt)
	return &x, err
}
func (r *Repository) ListMemberInvitations(ctx context.Context, userID, status string, limit int, before *time.Time, beforeID string) ([]models.CompanyMemberInvitation, error) {
	q := `SELECT i.invitation_id,i.company_id,c.full_name,i.invited_by,i.user_id,COALESCE(i.position,''),i.permissions,i.status,i.created_at,i.responded_at FROM company_member_invitations i JOIN companies c ON c.company_id=i.company_id WHERE i.user_id=$1 AND i.status=$2`
	args := []any{userID, status}
	if before != nil {
		args = append(args, *before, beforeID)
		q += ` AND (i.created_at,i.invitation_id)<($3,$4)`
	}
	args = append(args, limit)
	q += fmt.Sprintf(" ORDER BY i.created_at DESC,i.invitation_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.CompanyMemberInvitation, 0)
	for rows.Next() {
		var x models.CompanyMemberInvitation
		var p []byte
		if err = rows.Scan(&x.InvitationID, &x.CompanyID, &x.CompanyName, &x.InvitedBy, &x.UserID, &x.Position, &p, &x.Status, &x.CreatedAt, &x.RespondedAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(p, &x.Permissions); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) ListStudentInvitations(ctx context.Context, userID, status string, limit int, before *time.Time, beforeID string) ([]models.CompanyInvitation, error) {
	q := `SELECT company_invitation_id,company_id,student_id,case_id,kind,status,COALESCE(message,''),sent_at,responded_at FROM company_invitations WHERE student_id=$1 AND status=$2`
	args := []any{userID, status}
	if before != nil {
		args = append(args, *before, beforeID)
		q += ` AND (sent_at,company_invitation_id)<($3,$4)`
	}
	args = append(args, limit)
	q += fmt.Sprintf(" ORDER BY sent_at DESC,company_invitation_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.CompanyInvitation, 0)
	for rows.Next() {
		var x models.CompanyInvitation
		if err = rows.Scan(&x.InvitationID, &x.CompanyID, &x.StudentID, &x.CaseID, &x.Kind, &x.Status, &x.Message, &x.SentAt, &x.RespondedAt); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func scanCompany(row interface{ Scan(...any) error }) (*models.Company, error) {
	var c models.Company
	err := row.Scan(&c.CompanyID, &c.FullName, &c.ShortName, &c.Industry, &c.Description, &c.Activities, &c.Website, &c.Contacts, &c.LogoFileID, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	return &c, err
}

func (r *Repository) List(ctx context.Context, status string, limit int, before *time.Time, beforeID string) ([]models.Company, error) {
	return r.list(ctx, "status=$1", status, limit, before, beforeID)
}

func (r *Repository) ListMine(ctx context.Context, user string, limit int, before *time.Time, beforeID string) ([]models.Company, error) {
	return r.list(ctx, `EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=companies.company_id AND m.user_id=$1 AND m.status='active')`, user, limit, before, beforeID)
}

func (r *Repository) list(ctx context.Context, predicate, value string, limit int, before *time.Time, beforeID string) ([]models.Company, error) {
	query := `SELECT ` + companyColumns() + ` FROM companies WHERE ` + predicate
	args := []any{value}
	if before != nil {
		query += ` AND (created_at, company_id) < ($2, $3)`
		args = append(args, *before, beforeID)
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY created_at DESC, company_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list companies: %w", err)
	}
	defer rows.Close()
	items := make([]models.Company, 0)
	for rows.Next() {
		company, err := scanCompany(rows)
		if err != nil {
			return nil, fmt.Errorf("scan company: %w", err)
		}
		items = append(items, *company)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate companies: %w", err)
	}
	return items, nil
}

func (r *Repository) GetApproved(ctx context.Context, companyID string) (*models.Company, error) {
	company, err := scanCompany(r.db.QueryRowContext(ctx, `SELECT `+companyColumns()+` FROM companies WHERE company_id = $1 AND status = 'approved'`, companyID))
	if err != nil {
		return nil, fmt.Errorf("get company: %w", err)
	}
	return company, nil
}
func (r *Repository) GetByID(ctx context.Context, companyID string) (*models.Company, error) {
	return scanCompany(r.db.QueryRowContext(ctx, `SELECT `+companyColumns()+` FROM companies WHERE company_id=$1`, companyID))
}

func (r *Repository) Create(ctx context.Context, userID string, input models.CompanyInput) (*models.Company, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin company creation: %w", err)
	}
	defer tx.Rollback()
	company, err := scanCompany(tx.QueryRowContext(ctx, `INSERT INTO companies (full_name, short_name, industry, description, activities, website, contacts) VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,'')) RETURNING `+companyColumns(), input.FullName, input.ShortName, input.Industry, input.Description, input.Activities, input.Website, input.Contacts))
	if err != nil {
		return nil, fmt.Errorf("create company: %w", err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO company_members (company_id, user_id, position, permissions) VALUES ($1, $2, NULLIF($3,''), '["manage_company"]'::jsonb)`, company.CompanyID, userID, input.Position)
	if err != nil {
		return nil, fmt.Errorf("create company member: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit company creation: %w", err)
	}
	return company, nil
}

func (r *Repository) UpdateByMember(ctx context.Context, userID, companyID string, input models.CompanyInput) (*models.Company, error) {
	company, err := scanCompany(r.db.QueryRowContext(ctx, `UPDATE companies c SET full_name=$3, short_name=NULLIF($4,''), industry=NULLIF($5,''), description=NULLIF($6,''), activities=NULLIF($7,''), website=NULLIF($8,''), contacts=NULLIF($9,''), status=CASE WHEN c.status='approved' THEN 'pending' ELSE c.status END WHERE c.company_id=$1 AND EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING `+companyColumns(), companyID, userID, input.FullName, input.ShortName, input.Industry, input.Description, input.Activities, input.Website, input.Contacts))
	if err != nil {
		return nil, fmt.Errorf("update company: %w", err)
	}
	return company, nil
}

func (r *Repository) Moderate(ctx context.Context, moderatorID, companyID, status, comment string) (*models.Company, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin company moderation: %w", err)
	}
	defer tx.Rollback()
	var previous string
	if err := tx.QueryRowContext(ctx, `SELECT status FROM companies WHERE company_id=$1 FOR UPDATE`, companyID).Scan(&previous); err != nil {
		return nil, fmt.Errorf("select company status: %w", err)
	}
	if (status == "approved" || status == "rejected") && previous != "pending" {
		return nil, ErrInvalidTransition
	}
	if status == "suspended" && previous != "approved" {
		return nil, ErrInvalidTransition
	}
	company, err := scanCompany(tx.QueryRowContext(ctx, `UPDATE companies SET status=$2 WHERE company_id=$1 RETURNING `+companyColumns(), companyID, status))
	if err != nil {
		return nil, fmt.Errorf("moderate company: %w", err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO moderation_events (company_id, moderator_id, previous_status, new_status, comment) VALUES ($1,$2,$3,$4,NULLIF($5,''))`, companyID, moderatorID, previous, status, comment)
	if err != nil {
		return nil, fmt.Errorf("record moderation event: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit company moderation: %w", err)
	}
	return company, nil
}
