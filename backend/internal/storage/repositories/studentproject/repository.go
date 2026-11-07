package studentproject_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"
	"time"
)

var ErrForbidden = errors.New("student project access denied")
var ErrTransition = errors.New("invalid project transition")

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

const selectProject = `SELECT p.project_id,p.owner_id,p.title,p.category,p.short_description,p.full_description,p.problem_solved,p.github_url,p.product_url,p.cover_file_id,p.status,p.visibility,p.tags,p.moderation_comment,(SELECT count(*) FROM student_project_likes l WHERE l.project_id=p.project_id),(CASE WHEN $1='' THEN false ELSE EXISTS(SELECT 1 FROM student_project_likes l WHERE l.project_id=p.project_id AND l.user_id=NULLIF($1,'')::uuid) END),COALESCE((SELECT jsonb_agg(direction_id ORDER BY direction_id) FROM student_project_directions d WHERE d.project_id=p.project_id),'[]'),COALESCE((SELECT jsonb_agg(technology_id ORDER BY technology_id) FROM student_project_technologies t WHERE t.project_id=p.project_id),'[]'),COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id',m.student_id,'role_name',m.role_name,'joined_at',m.joined_at) ORDER BY m.joined_at) FROM project_members m WHERE m.project_id=p.project_id),'[]'),COALESCE((SELECT jsonb_agg(jsonb_build_object('file_id',f.file_id,'kind',f.kind,'ordinal',f.ordinal) ORDER BY f.ordinal) FROM student_project_files f WHERE f.project_id=p.project_id),'[]'),p.created_at,p.updated_at,p.published_at FROM student_projects p`

func scan(row interface{ Scan(...any) error }) (*models.StudentProject, error) {
	var x models.StudentProject
	var problem, gh, product, comment sql.NullString
	var dirs, tech, members, assets, tags []byte
	err := row.Scan(&x.ProjectID, &x.OwnerID, &x.Title, &x.Category, &x.ShortDescription, &x.FullDescription, &problem, &gh, &product, &x.CoverFileID, &x.Status, &x.Visibility, &tags, &comment, &x.LikesCount, &x.LikedByMe, &dirs, &tech, &members, &assets, &x.CreatedAt, &x.UpdatedAt, &x.PublishedAt)
	x.ProblemSolved = problem.String
	x.GithubURL = gh.String
	x.ProductURL = product.String
	x.ModerationComment = comment.String
	if err == nil {
		err = json.Unmarshal(tags, &x.Tags)
	}
	if err == nil {
		err = json.Unmarshal(dirs, &x.DirectionIDs)
	}
	if err == nil {
		err = json.Unmarshal(tech, &x.TechnologyIDs)
	}
	if err == nil {
		err = json.Unmarshal(members, &x.Members)
	}
	if err == nil {
		err = json.Unmarshal(assets, &x.Assets)
	}
	return &x, err
}
func (r *Repository) List(ctx context.Context, user, search, category, direction string, mine bool, limit int, before *time.Time, bid string) ([]models.StudentProject, error) {
	q := selectProject + ` WHERE p.status='published' AND p.visibility='public'`
	if mine {
		q = selectProject + ` WHERE p.owner_id=NULLIF($1,'')::uuid`
	}
	args := []any{user}
	if search != "" {
		args = append(args, "%"+search+"%")
		q += fmt.Sprintf(` AND (p.title ILIKE $%d OR p.short_description ILIKE $%d)`, len(args), len(args))
	}
	if category != "" {
		args = append(args, category)
		q += fmt.Sprintf(` AND p.category=$%d`, len(args))
	}
	if direction != "" {
		args = append(args, direction)
		q += fmt.Sprintf(` AND EXISTS(SELECT 1 FROM student_project_directions d WHERE d.project_id=p.project_id AND d.direction_id=$%d)`, len(args))
	}
	if before != nil {
		args = append(args, *before, bid)
		q += fmt.Sprintf(` AND (p.created_at,p.project_id)<($%d,$%d)`, len(args)-1, len(args))
	}
	args = append(args, limit)
	q += fmt.Sprintf(` ORDER BY p.created_at DESC,p.project_id DESC LIMIT $%d`, len(args))
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.StudentProject{}
	for rows.Next() {
		x, e := scan(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, *x)
	}
	return out, rows.Err()
}
func (r *Repository) Get(ctx context.Context, user, id string, admin bool) (*models.StudentProject, error) {
	return scan(r.db.QueryRowContext(ctx, selectProject+` WHERE p.project_id=$2 AND ((p.status='published' AND p.visibility='public') OR p.owner_id=NULLIF($1,'')::uuid OR $3)`, user, id, admin))
}
func (r *Repository) Create(ctx context.Context, user string, in models.StudentProjectInput) (*models.StudentProject, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var id string
	var cover any
	if in.CoverFileID != "" {
		cover = in.CoverFileID
	}
	tags, _ := json.Marshal(in.Tags)
	err = tx.QueryRowContext(ctx, `INSERT INTO student_projects(owner_id,title,category,short_description,full_description,problem_solved,github_url,product_url,cover_file_id,visibility,tags) SELECT s.user_id,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),$9,COALESCE(NULLIF($10,''),'public'),$11 FROM students s WHERE s.user_id=$1 AND ($9::uuid IS NULL OR EXISTS(SELECT 1 FROM files f WHERE f.file_id=$9 AND f.uploaded_by=$1 AND f.status='active')) RETURNING project_id`, user, in.Title, in.Category, in.ShortDescription, in.FullDescription, in.ProblemSolved, in.GithubURL, in.ProductURL, cover, in.Visibility, tags).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	if err = r.replaceRelations(ctx, tx, id, user, in); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.Get(ctx, user, id, false)
}
func (r *Repository) replaceRelations(ctx context.Context, tx *sql.Tx, id, user string, in models.StudentProjectInput) error {
	for _, d := range in.DirectionIDs {
		res, e := tx.ExecContext(ctx, `INSERT INTO student_project_directions(project_id,direction_id) SELECT $1,direction_id FROM directions WHERE direction_id=$2 AND is_active`, id, d)
		if e != nil {
			return e
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return ErrForbidden
		}
	}
	for _, t := range in.TechnologyIDs {
		res, e := tx.ExecContext(ctx, `INSERT INTO student_project_technologies(project_id,technology_id) SELECT $1,technology_id FROM technologies WHERE technology_id=$2 AND is_active`, id, t)
		if e != nil {
			return e
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return ErrForbidden
		}
	}
	if _, e := tx.ExecContext(ctx, `INSERT INTO project_members(project_id,student_id,role_name) VALUES($1,$2,'Owner')`, id, user); e != nil {
		return e
	}
	for _, m := range in.Members {
		if m.StudentID == user {
			continue
		}
		res, e := tx.ExecContext(ctx, `INSERT INTO project_members(project_id,student_id,role_name) SELECT $1,user_id,$3 FROM students WHERE user_id=$2`, id, m.StudentID, m.RoleName)
		if e != nil {
			return e
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return ErrForbidden
		}
	}
	for _, f := range in.Assets {
		res, e := tx.ExecContext(ctx, `INSERT INTO student_project_files(project_id,file_id,kind,ordinal) SELECT $1,file_id,$3,$4 FROM files WHERE file_id=$2 AND uploaded_by=$5 AND status='active'`, id, f.FileID, f.Kind, f.Ordinal, user)
		if e != nil {
			return e
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return ErrForbidden
		}
	}
	return nil
}
func (r *Repository) Update(ctx context.Context, user, id string, in models.StudentProjectInput) (*models.StudentProject, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	tags, _ := json.Marshal(in.Tags)
	res, err := tx.ExecContext(ctx, `UPDATE student_projects SET title=$3,category=$4,short_description=$5,full_description=$6,problem_solved=NULLIF($7,''),github_url=NULLIF($8,''),product_url=NULLIF($9,''),cover_file_id=NULLIF($10,'')::uuid,visibility=COALESCE(NULLIF($11,''),'public'),tags=$12,status=CASE WHEN status='revision' THEN 'draft' ELSE status END WHERE project_id=$1 AND owner_id=$2 AND status IN ('draft','revision') AND ($10='' OR EXISTS(SELECT 1 FROM files f WHERE f.file_id=NULLIF($10,'')::uuid AND f.uploaded_by=$2 AND f.status='active'))`, id, user, in.Title, in.Category, in.ShortDescription, in.FullDescription, in.ProblemSolved, in.GithubURL, in.ProductURL, in.CoverFileID, in.Visibility, tags)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrForbidden
	}
	for _, table := range []string{"student_project_directions", "student_project_technologies", "project_members", "student_project_files"} {
		if _, err = tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE project_id=$1", id); err != nil {
			return nil, err
		}
	}
	if err = r.replaceRelations(ctx, tx, id, user, in); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.Get(ctx, user, id, false)
}
func (r *Repository) Submit(ctx context.Context, user, id string) (*models.StudentProject, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE student_projects SET status='moderation',moderation_comment=NULL WHERE project_id=$1 AND owner_id=$2 AND status IN ('draft','revision')`, id, user)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrTransition
	}
	return r.Get(ctx, user, id, false)
}
func (r *Repository) Moderate(ctx context.Context, moderator, id, status, comment string) (*models.StudentProject, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var old string
	err = tx.QueryRowContext(ctx, `SELECT status FROM student_projects WHERE project_id=$1 FOR UPDATE`, id).Scan(&old)
	if err != nil {
		return nil, err
	}
	if old != "moderation" && status != "hidden" {
		return nil, ErrTransition
	}
	_, err = tx.ExecContext(ctx, `UPDATE student_projects SET status=$2,moderation_comment=NULLIF($3,''),published_at=CASE WHEN $2='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE project_id=$1`, id, status, comment)
	if err == nil {
		_, err = tx.ExecContext(ctx, `INSERT INTO student_project_moderation_events(project_id,moderator_id,previous_status,new_status,comment) VALUES($1,$2,$3,$4,NULLIF($5,''))`, id, moderator, old, status, comment)
	}
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.Get(ctx, moderator, id, true)
}
func (r *Repository) Like(ctx context.Context, user, id string, like bool) (int, error) {
	var exists bool
	if err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM student_projects WHERE project_id=$1 AND status='published')`, id).Scan(&exists); err != nil {
		return 0, err
	}
	if !exists {
		return 0, sql.ErrNoRows
	}
	var err error
	if like {
		_, err = r.db.ExecContext(ctx, `INSERT INTO student_project_likes(project_id,user_id) SELECT project_id,$2 FROM student_projects WHERE project_id=$1 AND status='published' ON CONFLICT DO NOTHING`, id, user)
	} else {
		_, err = r.db.ExecContext(ctx, `DELETE FROM student_project_likes WHERE project_id=$1 AND user_id=$2`, id, user)
	}
	if err != nil {
		return 0, err
	}
	var n int
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM student_project_likes WHERE project_id=$1`, id).Scan(&n)
	return n, err
}
