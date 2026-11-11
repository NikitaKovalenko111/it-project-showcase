package opportunity_repo

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"it-project-showcase/backend/internal/models"
)

var ErrInternshipFull = errors.New("internship capacity reached")

const internshipApplicationColumns = `application_id,program_id,student_id,cover_letter,resume_file_id,status,created_at,decided_at`

func scanInternshipApplication(row interface{ Scan(...any) error }) (*models.InternshipApplication, error) {
	var item models.InternshipApplication
	err := row.Scan(&item.ApplicationID, &item.ProgramID, &item.StudentID, &item.CoverLetter, &item.ResumeFileID, &item.Status, &item.CreatedAt, &item.DecidedAt)
	return &item, err
}

func (r *Repository) ApplyInternship(ctx context.Context, user, program, letter, resume string) (*models.InternshipApplication, error) {
	item, err := scanInternshipApplication(r.db.QueryRowContext(ctx, `INSERT INTO showcase.internship_applications(program_id,student_id,cover_letter,resume_file_id)
		SELECT p.program_id,s.user_id,$3,NULLIF($4,'')::uuid
		FROM showcase.internship_programs p CROSS JOIN showcase.students s JOIN showcase.users u ON u.user_id=s.user_id
		WHERE p.program_id=$1 AND s.user_id=$2 AND u.status='active' AND p.status='published'
		AND (p.application_deadline IS NULL OR p.application_deadline>statement_timestamp())
		AND (p.capacity IS NULL OR p.capacity > (SELECT count(*) FROM showcase.internship_applications a WHERE a.program_id=p.program_id AND a.status='accepted'))
		AND ($4='' OR EXISTS(SELECT 1 FROM showcase.files f WHERE f.file_id=NULLIF($4,'')::uuid AND f.uploaded_by=$2 AND f.status='active'))
		RETURNING `+internshipApplicationColumns, program, user, letter, resume))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return nil, ErrConflict
	}
	return item, err
}

func (r *Repository) ListInternshipApplications(ctx context.Context, user, program string, mine bool, limit int, offset int64) ([]models.InternshipApplication, int64, error) {
	const filter = ` WHERE ($2 AND a.student_id=$1) OR (NOT $2 AND a.program_id=NULLIF($3,'')::uuid
		AND EXISTS(SELECT 1 FROM showcase.internship_programs p JOIN showcase.company_members cm ON cm.company_id=p.company_id
		WHERE p.program_id=a.program_id AND cm.user_id=$1 AND cm.status='active' AND cm.permissions ? 'manage_company'))`
	rows, err := r.db.QueryContext(ctx, `SELECT a.application_id,a.program_id,a.student_id,a.cover_letter,a.resume_file_id,a.status,a.created_at,a.decided_at,
  program.title,program.kind,concat_ws(' ', student.last_name, student.first_name)
  FROM showcase.internship_applications a
  JOIN showcase.internship_programs program ON program.program_id=a.program_id
  JOIN showcase.students student ON student.user_id=a.student_id`+filter+
		` ORDER BY a.created_at DESC,a.application_id DESC LIMIT $4 OFFSET $5`, user, mine, program, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]models.InternshipApplication, 0)
	for rows.Next() {
		var item models.InternshipApplication
		if err := rows.Scan(&item.ApplicationID, &item.ProgramID, &item.StudentID, &item.CoverLetter,
			&item.ResumeFileID, &item.Status, &item.CreatedAt, &item.DecidedAt, &item.ProgramTitle,
			&item.ProgramKind, &item.StudentName); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int64
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.internship_applications a`+filter, user, mine, program).Scan(&total)
	return items, total, err
}

func (r *Repository) DecideInternshipApplication(ctx context.Context, user, application, status string) (*models.InternshipApplication, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var program string
	var capacity sql.NullInt64
	err = tx.QueryRowContext(ctx, `SELECT p.program_id,p.capacity FROM showcase.internship_applications a
		JOIN showcase.internship_programs p ON p.program_id=a.program_id WHERE a.application_id=$1
		AND (($3='withdrawn' AND a.student_id=$2) OR ($3<>'withdrawn' AND EXISTS(
			SELECT 1 FROM showcase.company_members m WHERE m.company_id=p.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company')))
		FOR UPDATE OF p`, application, user, status).Scan(&program, &capacity)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	if status == "accepted" && capacity.Valid {
		var occupied int64
		if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM showcase.internship_applications WHERE program_id=$1 AND status='accepted'`, program).Scan(&occupied); err != nil {
			return nil, err
		}
		if occupied >= capacity.Int64 {
			return nil, ErrInternshipFull
		}
	}
	item, err := scanInternshipApplication(tx.QueryRowContext(ctx, `UPDATE showcase.internship_applications SET status=$2,decided_at=statement_timestamp()
		WHERE application_id=$1 AND status='submitted' RETURNING `+internshipApplicationColumns, application, status))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrConflict
	}
	if err != nil {
		return nil, err
	}
	return item, tx.Commit()
}
