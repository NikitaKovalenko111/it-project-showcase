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
