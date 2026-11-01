package company_repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"it-project-showcase/backend/internal/models"
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

func companyColumns() string {
	return `company_id, full_name, COALESCE(short_name, ''), COALESCE(industry, ''), COALESCE(description, ''), COALESCE(activities, ''), COALESCE(website, ''), COALESCE(contacts, ''), logo_file_id, status, created_at, updated_at`
}
func scanCompany(row interface{ Scan(...any) error }) (*models.Company, error) {
	var c models.Company
	err := row.Scan(&c.CompanyID, &c.FullName, &c.ShortName, &c.Industry, &c.Description, &c.Activities, &c.Website, &c.Contacts, &c.LogoFileID, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	return &c, err
}

func (r *Repository) List(ctx context.Context, status string, limit int, before *time.Time, beforeID string) ([]models.Company, error) {
	query := `SELECT ` + companyColumns() + ` FROM companies WHERE status = $1`
	args := []any{status}
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
