package file_repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"it-project-showcase/backend/internal/models"
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

const fileColumns = `file_id, storage_key, original_name, mime_type, size_bytes, checksum_sha256, uploaded_by, created_at`

func (r *Repository) GetFeedbackFile(ctx context.Context, feedbackID, fileID, userID string, admin bool) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at
		FROM showcase.feedback_files x JOIN showcase.feedback_messages m ON m.feedback_id=x.feedback_id
		JOIN showcase.files f ON f.file_id=x.file_id
		WHERE x.feedback_id=$1 AND x.file_id=$2 AND f.status='active' AND (m.author_id=$3 OR $4)`, feedbackID, fileID, userID, admin))
}

func (r *Repository) GetInternshipResume(ctx context.Context, applicationID, userID string, admin bool) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at
		FROM showcase.internship_applications a JOIN showcase.internship_programs p ON p.program_id=a.program_id
		JOIN showcase.files f ON f.file_id=a.resume_file_id AND f.status='active'
		WHERE a.application_id=$1 AND ($3 OR a.student_id=$2 OR EXISTS(SELECT 1 FROM showcase.company_members m
		WHERE m.company_id=p.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company'))`, applicationID, userID, admin))
}

func scanFile(row interface{ Scan(...any) error }) (*models.File, error) {
	var file models.File
	err := row.Scan(&file.FileID, &file.StorageKey, &file.OriginalName, &file.MIMEType, &file.SizeBytes, &file.ChecksumSHA256, &file.UploadedBy, &file.CreatedAt)
	return &file, err
}

func (r *Repository) Create(ctx context.Context, file models.File) (*models.File, error) {
	created, err := scanFile(r.db.QueryRowContext(ctx, `INSERT INTO files (storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING `+fileColumns, file.StorageKey, file.OriginalName, file.MIMEType, file.SizeBytes, file.ChecksumSHA256, file.UploadedBy))
	if err != nil {
		return nil, fmt.Errorf("create file metadata: %w", err)
	}
	return created, nil
}
func (r *Repository) GetAccessible(ctx context.Context, fileID, userID string, isAdmin bool) (*models.File, error) {
	file, err := scanFile(r.db.QueryRowContext(ctx, `SELECT `+fileColumns+` FROM files WHERE file_id=$1 AND status='active' AND (uploaded_by=$2 OR $3)`, fileID, userID, isAdmin))
	if err != nil {
		return nil, fmt.Errorf("get accessible file: %w", err)
	}
	return file, nil
}
func (r *Repository) GetPublicCompanyLogo(ctx context.Context, companyID string) (*models.File, error) {
	file, err := scanFile(r.db.QueryRowContext(ctx, `SELECT f.`+`file_id, f.storage_key, f.original_name, f.mime_type, f.size_bytes, f.checksum_sha256, f.uploaded_by, f.created_at FROM companies c JOIN files f ON f.file_id=c.logo_file_id WHERE c.company_id=$1 AND c.status='approved' AND f.status='active'`, companyID))
	if err != nil {
		return nil, fmt.Errorf("get public company logo: %w", err)
	}
	return file, nil
}
func (r *Repository) GetPublicCaseFile(ctx context.Context, caseID, fileID string) (*models.File, error) {
	file, err := scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM cases c JOIN case_files cf ON cf.case_id=c.case_id JOIN files f ON f.file_id=cf.file_id WHERE c.case_id=$1 AND f.file_id=$2 AND c.status IN ('published','in_progress','completed') AND c.visibility='public' AND cf.visibility='public' AND f.status='active'`, caseID, fileID))
	if err != nil {
		return nil, fmt.Errorf("get public case file: %w", err)
	}
	return file, nil
}
func (r *Repository) GetProtectedCaseFile(ctx context.Context, caseID, fileID, userID string, isAdmin bool) (*models.File, error) {
	file, err := scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM cases c JOIN case_files cf ON cf.case_id=c.case_id JOIN files f ON f.file_id=cf.file_id AND f.status='active' WHERE c.case_id=$1 AND f.file_id=$2 AND ($4 OR EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company') OR (cf.visibility='participants' AND EXISTS(SELECT 1 FROM executions e JOIN execution_members em ON em.execution_id=e.execution_id AND em.student_id=$3 AND em.left_at IS NULL WHERE e.case_id=c.case_id AND e.status NOT IN ('closed','cancelled')) AND (NOT c.nda_required OR EXISTS(SELECT 1 FROM nda_grants n WHERE n.case_id=c.case_id AND n.student_id=$3 AND n.status='granted'))))`, caseID, fileID, userID, isAdmin))
	if err != nil {
		return nil, fmt.Errorf("get protected case file: %w", err)
	}
	return file, nil
}
func (r *Repository) GetApplicationResume(ctx context.Context, applicationID, userID string, isAdmin bool) (*models.File, error) {
	file, err := scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM applications a JOIN cases c ON c.case_id=a.case_id JOIN files f ON f.file_id=a.resume_file_id AND f.status='active' WHERE a.application_id=$1 AND ($3 OR a.student_id=$2 OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=a.team_id AND tm.student_id=$2 AND tm.left_at IS NULL) OR EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))`, applicationID, userID, isAdmin))
	if err != nil {
		return nil, fmt.Errorf("get application resume: %w", err)
	}
	return file, nil
}

func (r *Repository) GetSubmissionFile(ctx context.Context, submissionID, fileID, userID string, isAdmin bool) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM submissions s JOIN submission_files sf ON sf.submission_id=s.submission_id JOIN files f ON f.file_id=sf.file_id AND f.status='active' JOIN executions e ON e.execution_id=s.execution_id JOIN cases c ON c.case_id=e.case_id WHERE s.submission_id=$1 AND f.file_id=$2 AND ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$3 AND m.left_at IS NULL) OR EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company'))`, submissionID, fileID, userID, isAdmin))
}

func (r *Repository) GetPublicStudentProjectFile(ctx context.Context, projectID, fileID string) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM student_projects p JOIN files f ON f.file_id=$2 AND f.status='active' WHERE p.project_id=$1 AND p.status='published' AND p.visibility='public' AND (p.cover_file_id=f.file_id OR EXISTS(SELECT 1 FROM student_project_files pf WHERE pf.project_id=p.project_id AND pf.file_id=f.file_id))`, projectID, fileID))
}

func (r *Repository) GetPublicPortfolioFile(ctx context.Context, studentID, fileID string) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM student_profile_files pf JOIN files f ON f.file_id=pf.file_id AND f.status='active' WHERE pf.student_id=$1 AND pf.file_id=$2 AND pf.visibility='public' AND pf.detached_at IS NULL`, studentID, fileID))
}

func (r *Repository) GetPublicCaseCover(ctx context.Context, caseID string) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at FROM cases c JOIN files f ON f.file_id=c.cover_file_id AND f.status='active' WHERE c.case_id=$1 AND c.status IN ('published','in_progress','completed') AND c.visibility='public'`, caseID))
}

func (r *Repository) CreateCompanyLogo(ctx context.Context, userID, companyID string, file models.File) (*models.File, string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, "", fmt.Errorf("begin company logo update: %w", err)
	}
	defer tx.Rollback()
	var oldKey sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT f.storage_key FROM companies c JOIN company_members cm ON cm.company_id=c.company_id LEFT JOIN files f ON f.file_id=c.logo_file_id AND f.status='active' WHERE c.company_id=$1 AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company' FOR UPDATE OF c`, companyID, userID).Scan(&oldKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", sql.ErrNoRows
	}
	if err != nil {
		return nil, "", fmt.Errorf("authorize company logo update: %w", err)
	}
	created, err := scanFile(tx.QueryRowContext(ctx, `INSERT INTO files (storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING `+fileColumns, file.StorageKey, file.OriginalName, file.MIMEType, file.SizeBytes, file.ChecksumSHA256, file.UploadedBy))
	if err != nil {
		return nil, "", fmt.Errorf("create logo metadata: %w", err)
	}
	_, err = tx.ExecContext(ctx, `UPDATE companies SET logo_file_id=$2,status=CASE WHEN status='approved' THEN 'pending' ELSE status END WHERE company_id=$1`, companyID, created.FileID)
	if err != nil {
		return nil, "", fmt.Errorf("attach company logo: %w", err)
	}
	if oldKey.Valid {
		_, err = tx.ExecContext(ctx, `UPDATE files SET status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE storage_key=$1`, oldKey.String)
		if err != nil {
			return nil, "", fmt.Errorf("retire previous logo: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, "", fmt.Errorf("commit company logo update: %w", err)
	}
	return created, oldKey.String, nil
}

func (r *Repository) CreateStudentPhoto(ctx context.Context, userID string, file models.File) (*models.File, string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, "", fmt.Errorf("begin student photo update: %w", err)
	}
	defer tx.Rollback()
	var oldKey sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT f.storage_key FROM students s LEFT JOIN files f ON f.file_id=s.photo_file_id AND f.status='active' WHERE s.user_id=$1 FOR UPDATE OF s`, userID).Scan(&oldKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", sql.ErrNoRows
	}
	if err != nil {
		return nil, "", fmt.Errorf("select student photo: %w", err)
	}
	created, err := scanFile(tx.QueryRowContext(ctx, `INSERT INTO files (storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING `+fileColumns, file.StorageKey, file.OriginalName, file.MIMEType, file.SizeBytes, file.ChecksumSHA256, file.UploadedBy))
	if err != nil {
		return nil, "", fmt.Errorf("create photo metadata: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE students SET photo_file_id=$2 WHERE user_id=$1`, userID, created.FileID); err != nil {
		return nil, "", fmt.Errorf("attach student photo: %w", err)
	}
	if oldKey.Valid {
		if _, err = tx.ExecContext(ctx, `UPDATE files SET status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE storage_key=$1`, oldKey.String); err != nil {
			return nil, "", fmt.Errorf("retire previous photo: %w", err)
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, "", fmt.Errorf("commit student photo update: %w", err)
	}
	return created, oldKey.String, nil
}
