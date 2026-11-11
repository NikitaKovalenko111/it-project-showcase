package community_repo

import (
	"context"
	"encoding/json"
	"errors"

	"it-project-showcase/backend/internal/models"
)

var ErrFeedbackFile = errors.New("feedback file is unavailable or too large")

const feedbackSelect = `SELECT x.feedback_id,x.author_id,x.body,x.status,x.moderator_id,x.created_at,x.reviewed_at,
	COALESCE((SELECT jsonb_agg(f.file_id ORDER BY f.ordinal) FROM showcase.feedback_files f WHERE f.feedback_id=x.feedback_id),'[]'::jsonb)
	FROM showcase.feedback_messages x`

func scanFeedback(row interface{ Scan(...any) error }) (*models.Feedback, error) {
	var x models.Feedback
	var files []byte
	if err := row.Scan(&x.FeedbackID, &x.AuthorID, &x.Body, &x.Status, &x.ModeratorID, &x.CreatedAt, &x.ReviewedAt, &files); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(files, &x.FileIDs); err != nil {
		return nil, err
	}
	return &x, nil
}

func (r *Repository) CreateFeedback(ctx context.Context, author, body string, files []string) (*models.Feedback, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var id string
	if err = tx.QueryRowContext(ctx, `INSERT INTO showcase.feedback_messages(author_id,body) VALUES($1,$2) RETURNING feedback_id`, author, body).Scan(&id); err != nil {
		return nil, err
	}
	for i, file := range files {
		result, err := tx.ExecContext(ctx, `INSERT INTO showcase.feedback_files(feedback_id,file_id,ordinal)
			SELECT $1,file_id,$3 FROM showcase.files WHERE file_id=$2 AND uploaded_by=$4 AND status='active' AND size_bytes<=2097152`, id, file, i+1, author)
		if err != nil {
			return nil, err
		}
		if n, err := result.RowsAffected(); err != nil || n != 1 {
			if err != nil {
				return nil, err
			}
			return nil, ErrFeedbackFile
		}
	}
	item, err := scanFeedback(tx.QueryRowContext(ctx, feedbackSelect+` WHERE x.feedback_id=$1`, id))
	if err != nil {
		return nil, err
	}
	return item, tx.Commit()
}

func (r *Repository) ListFeedback(ctx context.Context, user, status string, admin bool, limit int, offset int64) ([]models.Feedback, int64, error) {
	const filter = ` WHERE ($2 OR x.author_id=$1) AND ($3='' OR x.status=$3)`
	rows, err := r.db.QueryContext(ctx, feedbackSelect+filter+` ORDER BY x.created_at DESC,x.feedback_id DESC LIMIT $4 OFFSET $5`, user, admin, status, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]models.Feedback, 0)
	for rows.Next() {
		item, err := scanFeedback(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int64
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.feedback_messages x`+filter, user, admin, status).Scan(&total)
	return items, total, err
}

func (r *Repository) ReviewFeedback(ctx context.Context, actor, id, status string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE showcase.feedback_messages SET status=$3,moderator_id=$2,reviewed_at=CURRENT_TIMESTAMP WHERE feedback_id=$1 AND status='reviewing'`, id, actor, status)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil || n != 1 {
		if err != nil {
			return err
		}
		return ErrNotFound
	}
	return nil
}
