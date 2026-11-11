package community_repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"

	"github.com/jackc/pgx/v5/pgconn"
)

var ErrNotFound = errors.New("community resource not found")
var ErrConflict = errors.New("community resource conflict")

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

const commentColumns = `c.comment_id,c.resource_type,c.resource_id,c.parent_comment_id,c.author_id,
COALESCE(NULLIF(concat_ws(' ',s.last_name,s.first_name),''),u.username),s.photo_file_id,
CASE WHEN c.status='active' THEN c.body ELSE '' END,c.status,
(SELECT count(*) FROM comments r WHERE r.parent_comment_id=c.comment_id AND r.status<>'hidden'),
CASE WHEN c.status='active' THEN (SELECT count(*) FROM showcase.comment_likes l WHERE l.comment_id=c.comment_id) ELSE 0 END,
c.status='active' AND EXISTS(SELECT 1 FROM showcase.comment_likes l WHERE l.comment_id=c.comment_id AND l.user_id=NULLIF($1,'')::uuid),
c.created_at,c.updated_at,c.deleted_at`

const publicCommentResource = `((c.resource_type='case' AND EXISTS(SELECT 1 FROM showcase.cases x
	WHERE x.case_id=c.resource_id AND x.status IN ('published','in_progress','completed') AND x.visibility='public'))
	OR (c.resource_type='student_project' AND EXISTS(SELECT 1 FROM showcase.student_projects x
	WHERE x.project_id=c.resource_id AND x.status='published' AND x.visibility='public')))`

func scanComment(row interface{ Scan(...any) error }) (*models.Comment, error) {
	var x models.Comment
	err := row.Scan(&x.CommentID, &x.ResourceType, &x.ResourceID, &x.ParentCommentID, &x.AuthorID, &x.AuthorName, &x.AuthorPhotoID, &x.Body, &x.Status, &x.ReplyCount, &x.LikesCount, &x.LikedByMe, &x.CreatedAt, &x.UpdatedAt, &x.DeletedAt)
	return &x, err
}
func (r *Repository) CreateComment(ctx context.Context, userID, kind, resourceID string, parent *string, body string) (*models.Comment, error) {
	var id string
	err := r.db.QueryRowContext(ctx, `INSERT INTO showcase.comments(resource_type,resource_id,parent_comment_id,author_id,body) VALUES($1,$2,$3,$4,$5) RETURNING comment_id`, kind, resourceID, parent, userID, body).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("create comment: %w", err)
	}
	return r.GetComment(ctx, id)
}
func (r *Repository) GetComment(ctx context.Context, id string) (*models.Comment, error) {
	x, err := scanComment(r.db.QueryRowContext(ctx, `SELECT `+commentColumns+` FROM showcase.comments c JOIN showcase.users u ON u.user_id=c.author_id LEFT JOIN showcase.students s ON s.user_id=c.author_id WHERE c.comment_id=$2`, "", id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get comment: %w", err)
	}
	return x, nil
}
func (r *Repository) ListComments(ctx context.Context, viewer, kind, resourceID string, parent *string, sort string, limit, offset int) ([]models.Comment, int, error) {
	order := `c.created_at DESC,c.comment_id DESC`
	if sort == "oldest" {
		order = `c.created_at,c.comment_id`
	} else if sort == "popular" {
		order = `(SELECT count(*) FROM showcase.comments z WHERE z.parent_comment_id=c.comment_id AND z.status='active') DESC,c.created_at DESC,c.comment_id DESC`
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+commentColumns+` FROM showcase.comments c JOIN showcase.users u ON u.user_id=c.author_id LEFT JOIN showcase.students s ON s.user_id=c.author_id WHERE c.resource_type=$2 AND c.resource_id=$3 AND c.parent_comment_id IS NOT DISTINCT FROM $4 AND c.status<>'hidden' AND `+publicCommentResource+` ORDER BY `+order+` LIMIT $5 OFFSET $6`, viewer, kind, resourceID, parent, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()
	items := make([]models.Comment, 0)
	for rows.Next() {
		x, e := scanComment(rows)
		if e != nil {
			return nil, 0, e
		}
		items = append(items, *x)
	}
	var total int
	if err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.comments c WHERE c.resource_type=$1 AND c.resource_id=$2 AND c.parent_comment_id IS NOT DISTINCT FROM $3 AND c.status<>'hidden' AND `+publicCommentResource, kind, resourceID, parent).Scan(&total); err != nil {
		return nil, 0, err
	}
	return items, total, rows.Err()
}

func (r *Repository) SetCommentLike(ctx context.Context, userID, commentID string, like bool) (models.CommentLikeState, error) {
	var state models.CommentLikeState
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return state, err
	}
	defer tx.Rollback()
	var id string
	err = tx.QueryRowContext(ctx, `SELECT c.comment_id FROM showcase.comments c WHERE c.comment_id=$1 AND c.status='active' AND `+publicCommentResource+` FOR UPDATE OF c`, commentID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return state, ErrNotFound
	}
	if err != nil {
		return state, err
	}
	query := `DELETE FROM showcase.comment_likes WHERE comment_id=$1 AND user_id=$2`
	if like {
		query = `INSERT INTO showcase.comment_likes(comment_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`
	}
	if _, err = tx.ExecContext(ctx, query, id, userID); err != nil {
		return state, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM showcase.comment_likes WHERE comment_id=$1`, id).Scan(&state.LikesCount); err != nil {
		return state, err
	}
	state.LikedByMe = like
	return state, tx.Commit()
}
func (r *Repository) DeleteComment(ctx context.Context, userID, id string, admin bool) error {
	res, err := r.db.ExecContext(ctx, `UPDATE showcase.comments SET status='deleted',body='',deleted_at=CURRENT_TIMESTAMP WHERE comment_id=$1 AND status='active' AND (author_id=$2 OR $3)`, id, userID, admin)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
func (r *Repository) CreateReport(ctx context.Context, userID, kind, id, reason, details string) (*models.Report, error) {
	var reportID string
	err := r.db.QueryRowContext(ctx, `INSERT INTO showcase.reports(reporter_id,resource_type,resource_id,reason,details) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reporter_id,resource_type,resource_id) WHERE status IN ('open','reviewing') DO NOTHING RETURNING report_id`, userID, kind, id, reason, details).Scan(&reportID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrConflict
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("create report: %w", err)
	}
	return r.GetReport(ctx, reportID)
}
func scanReport(row interface{ Scan(...any) error }) (*models.Report, error) {
	var x models.Report
	var resolution sql.NullString
	err := row.Scan(&x.ReportID, &x.ReporterID, &x.ResourceType, &x.ResourceID, &x.Reason, &x.Details, &x.Status, &resolution, &x.ModeratorID, &x.CreatedAt, &x.UpdatedAt, &x.ResolvedAt)
	if resolution.Valid {
		x.Resolution = resolution.String
	}
	return &x, err
}
func (r *Repository) GetReport(ctx context.Context, id string) (*models.Report, error) {
	x, e := scanReport(r.db.QueryRowContext(ctx, `SELECT report_id,reporter_id,resource_type,resource_id,reason,details,status,resolution,moderator_id,created_at,updated_at,resolved_at FROM showcase.reports WHERE report_id=$1`, id))
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return x, e
}
func (r *Repository) ListReports(ctx context.Context, status string, limit, offset int) ([]models.Report, int, error) {
	rows, e := r.db.QueryContext(ctx, `SELECT report_id,reporter_id,resource_type,resource_id,reason,details,status,resolution,moderator_id,created_at,updated_at,resolved_at FROM showcase.reports WHERE ($1='' OR status=$1) ORDER BY created_at,report_id LIMIT $2 OFFSET $3`, status, limit, offset)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	items := make([]models.Report, 0)
	for rows.Next() {
		x, e := scanReport(rows)
		if e != nil {
			return nil, 0, e
		}
		items = append(items, *x)
	}
	var total int
	e = r.db.QueryRowContext(ctx, `SELECT count(*) FROM showcase.reports WHERE ($1='' OR status=$1)`, status).Scan(&total)
	return items, total, e
}
func (r *Repository) UpdateReport(ctx context.Context, moderator, id, status, resolution string) (*models.Report, error) {
	res, e := r.db.ExecContext(ctx, `UPDATE showcase.reports SET status=$2,resolution=NULLIF($3,''),moderator_id=$4,resolved_at=CASE WHEN $2 IN ('resolved','rejected') THEN CURRENT_TIMESTAMP ELSE NULL END WHERE report_id=$1`, id, status, resolution, moderator)
	if e != nil {
		return nil, e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return r.GetReport(ctx, id)
}
