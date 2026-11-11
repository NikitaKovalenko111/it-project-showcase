package platform_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"
	"time"
)

var ErrForbidden = errors.New("platform access denied")

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }
func (r *Repository) SetFavorite(ctx context.Context, u, kind, id string, on bool) error {
	table, key, status := "case_favorites", "case_id", "c.status IN ('published','in_progress','completed')"
	source := "cases c"
	if kind == "student_project" {
		table, key, status, source = "student_project_favorites", "project_id", "c.status='published'", "student_projects c"
	}
	if on {
		res, e := r.db.ExecContext(ctx, fmt.Sprintf(`INSERT INTO %s(user_id,%s) SELECT $1,c.%s FROM %s WHERE c.%s=$2 AND %s ON CONFLICT DO NOTHING`, table, key, key, source, key, status), u, id)
		if e != nil {
			return e
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			var exists bool
			e = r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT EXISTS(SELECT 1 FROM %s WHERE %s=$1)`, source, key), id).Scan(&exists)
			if e != nil {
				return e
			}
			if !exists {
				return sql.ErrNoRows
			}
			return ErrForbidden
		}
		return nil
	}
	_, e := r.db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE user_id=$1 AND %s=$2`, table, key), u, id)
	return e
}
func (r *Repository) ListFavorites(ctx context.Context, u string, limit int, before *time.Time, bid string) ([]models.Favorite, error) {
	q := `SELECT resource_type,resource_id,title,created_at FROM (SELECT 'case' resource_type,f.case_id resource_id,c.title,f.created_at FROM case_favorites f JOIN cases c ON c.case_id=f.case_id WHERE f.user_id=$1 UNION ALL SELECT 'student_project',f.project_id,p.title,f.created_at FROM student_project_favorites f JOIN student_projects p ON p.project_id=f.project_id WHERE f.user_id=$1) x WHERE true`
	args := []any{u}
	if before != nil {
		args = append(args, *before, bid)
		q += fmt.Sprintf(` AND (created_at,resource_id)<($%d,$%d)`, len(args)-1, len(args))
	}
	args = append(args, limit)
	q += fmt.Sprintf(` ORDER BY created_at DESC,resource_id DESC LIMIT $%d`, len(args))
	rows, e := r.db.QueryContext(ctx, q, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.Favorite{}
	for rows.Next() {
		var x models.Favorite
		if e = rows.Scan(&x.ResourceType, &x.ResourceID, &x.Title, &x.CreatedAt); e != nil {
			return nil, e
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) ListNotifications(ctx context.Context, u string, unread bool, limit int, before *time.Time, bid string) ([]models.Notification, error) {
	q := `SELECT notification_id,type,title,body,resource_type,resource_id,metadata,created_at,read_at FROM notifications WHERE user_id=$1`
	args := []any{u}
	if unread {
		q += ` AND read_at IS NULL`
	}
	if before != nil {
		args = append(args, *before, bid)
		q += fmt.Sprintf(` AND (created_at,notification_id)<($%d,$%d)`, len(args)-1, len(args))
	}
	args = append(args, limit)
	q += fmt.Sprintf(` ORDER BY created_at DESC,notification_id DESC LIMIT $%d`, len(args))
	rows, e := r.db.QueryContext(ctx, q, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.Notification{}
	for rows.Next() {
		var x models.Notification
		var raw []byte
		if e = rows.Scan(&x.NotificationID, &x.Type, &x.Title, &x.Body, &x.ResourceType, &x.ResourceID, &raw, &x.CreatedAt, &x.ReadAt); e != nil {
			return nil, e
		}
		if e = json.Unmarshal(raw, &x.Metadata); e != nil {
			return nil, e
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) ReadNotification(ctx context.Context, u, id string) error {
	res, e := r.db.ExecContext(ctx, `UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE notification_id=$1 AND user_id=$2`, id, u)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
func (r *Repository) ReadAll(ctx context.Context, u string) error {
	_, e := r.db.ExecContext(ctx, `UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND read_at IS NULL`, u)
	return e
}

func (r *Repository) NotificationMarker(ctx context.Context, u, id string) (time.Time, string, error) {
	var created time.Time
	var notificationID string
	err := r.db.QueryRowContext(ctx, `SELECT created_at,notification_id FROM notifications WHERE user_id=$1 AND notification_id=$2`, u, id).Scan(&created, &notificationID)
	return created, notificationID, err
}

func (r *Repository) LatestNotificationMarker(ctx context.Context, u string) (time.Time, string, error) {
	var created time.Time
	var notificationID string
	err := r.db.QueryRowContext(ctx, `SELECT created_at,notification_id FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,notification_id DESC LIMIT 1`, u).Scan(&created, &notificationID)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, "00000000-0000-0000-0000-000000000000", nil
	}
	return created, notificationID, err
}

func (r *Repository) NotificationsAfter(ctx context.Context, u string, after time.Time, afterID string, limit int) ([]models.Notification, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT notification_id,type,title,body,resource_type,resource_id,metadata,created_at,read_at FROM notifications WHERE user_id=$1 AND (created_at,notification_id)>($2,$3) ORDER BY created_at,notification_id LIMIT $4`, u, after, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.Notification, 0)
	for rows.Next() {
		var item models.Notification
		var raw []byte
		if err = rows.Scan(&item.NotificationID, &item.Type, &item.Title, &item.Body, &item.ResourceType, &item.ResourceID, &raw, &item.CreatedAt, &item.ReadAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &item.Metadata); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func (r *Repository) ListAudit(ctx context.Context, entity, action string, limit int, offset int64) ([]models.AuditLog, int64, error) {
	where := ` WHERE ($1='' OR entity_type=$1) AND ($2='' OR action=$2)`
	var total int64
	if e := r.db.QueryRowContext(ctx, `SELECT count(*) FROM audit_logs`+where, entity, action).Scan(&total); e != nil {
		return nil, 0, e
	}
	rows, e := r.db.QueryContext(ctx, `SELECT audit_id,actor_id,request_id,action,entity_type,entity_id,old_data,new_data,host(ip_address),created_at FROM audit_logs`+where+` ORDER BY created_at DESC,audit_id DESC LIMIT $3 OFFSET $4`, entity, action, limit, offset)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []models.AuditLog{}
	for rows.Next() {
		var x models.AuditLog
		var old, new []byte
		if e = rows.Scan(&x.AuditID, &x.ActorID, &x.RequestID, &x.Action, &x.EntityType, &x.EntityID, &old, &new, &x.IPAddress, &x.CreatedAt); e != nil {
			return nil, 0, e
		}
		if len(old) > 0 {
			_ = json.Unmarshal(old, &x.OldData)
		}
		if len(new) > 0 {
			_ = json.Unmarshal(new, &x.NewData)
		}
		out = append(out, x)
	}
	return out, total, rows.Err()
}
func scanStudent(row interface{ Scan(...any) error }) (models.StudentSearchItem, error) {
	var x models.StudentSearchItem
	var c, t []byte
	e := row.Scan(&x.UserID, &x.Username, &x.FullName, &x.Institute, &x.Direction, &x.Course, &c, &t, &x.PhotoFileID, &x.Rating, &x.CreatedAt, &x.GroupName, &x.CuratorID, &x.EducationLevel)
	if e == nil {
		e = json.Unmarshal(c, &x.Competencies)
	}
	if e == nil {
		e = json.Unmarshal(t, &x.Technologies)
	}
	return x, e
}

const studentSelect = `SELECT u.user_id,u.username,concat_ws(' ',s.last_name,s.first_name,s.patronymic),s.institute_name,s.study_direction,s.course,s.competencies,s.technologies,s.photo_file_id,COALESCE(r.quality_score+r.completion_score+r.project_score+r.achievement_score,0),u.created_at,s.group_name,sc.curator_id,COALESCE(s.education_level,'') FROM students s JOIN users u ON u.user_id=s.user_id LEFT JOIN student_ratings r ON r.student_id=s.user_id LEFT JOIN student_curators sc ON sc.student_id=s.user_id AND sc.revoked_at IS NULL`

const studentSearchWhere = ` WHERE u.status='active'
	AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles role ON role.role_id=ur.role_id WHERE ur.user_id=u.user_id AND role.code='student')
	AND ($1='' OR concat_ws(' ',s.last_name,s.first_name,s.patronymic) ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%')
	AND ($2='' OR s.study_direction=$2) AND ($3='' OR s.technologies ? $3)
	AND ($4='' OR s.group_name=$4) AND ($5='' OR s.education_level=$5)`

func (r *Repository) SearchStudents(ctx context.Context, filter models.StudentSearchFilter, limit int, before *time.Time, bid string) ([]models.StudentSearchItem, error) {
	sqlq := studentSelect + studentSearchWhere
	args := []any{filter.Query, filter.Direction, filter.Technology, filter.GroupName, filter.EducationLevel}
	if before != nil {
		args = append(args, *before, bid)
		sqlq += fmt.Sprintf(` AND (u.created_at,u.user_id)<($%d,$%d)`, len(args)-1, len(args))
	}
	args = append(args, limit)
	sqlq += fmt.Sprintf(` ORDER BY u.created_at DESC,u.user_id DESC LIMIT $%d`, len(args))
	rows, e := r.db.QueryContext(ctx, sqlq, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.StudentSearchItem{}
	for rows.Next() {
		x, er := scanStudent(rows)
		if er != nil {
			return nil, er
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) SearchStudentsByRating(ctx context.Context, filter models.StudentSearchFilter, sort string, limit int, offset int64) ([]models.StudentSearchItem, int, error) {
	args := []any{filter.Query, filter.Direction, filter.Technology, filter.GroupName, filter.EducationLevel}
	order := "DESC"
	if sort == "rating_asc" {
		order = "ASC"
	}
	rows, e := r.db.QueryContext(ctx, studentSelect+studentSearchWhere+` ORDER BY 10 `+order+`,u.user_id DESC LIMIT $6 OFFSET $7`, append(args, limit, offset)...)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []models.StudentSearchItem{}
	for rows.Next() {
		x, e := scanStudent(rows)
		if e != nil {
			return nil, 0, e
		}
		out = append(out, x)
	}
	if err := rows.Err(); err != nil { return nil, 0, err }
	var total int
	e = r.db.QueryRowContext(ctx, `SELECT count(*) FROM students s JOIN users u ON u.user_id=s.user_id`+studentSearchWhere, args...).Scan(&total)
	return out, total, e
}
func (r *Repository) GetPortfolio(ctx context.Context, viewer, student string, admin bool) (*models.Portfolio, error) {
	var p models.Portfolio
	var visibility, headline, about string
	var projects, executions, certs, awards []byte
	e := r.db.QueryRowContext(ctx, `SELECT COALESCE(ps.visibility,'public'),COALESCE(ps.headline,''),COALESCE(ps.about,''),COALESCE((SELECT jsonb_agg(jsonb_build_object('project_id',x.project_id,'owner_id',x.owner_id,'title',x.title,'category',x.category,'short_description',x.short_description,'full_description',x.full_description,'status',x.status,'visibility',x.visibility,'tags',x.tags,'likes_count',(SELECT count(*) FROM student_project_likes l WHERE l.project_id=x.project_id),'direction_ids','[]'::jsonb,'technology_ids','[]'::jsonb,'members','[]'::jsonb,'assets','[]'::jsonb,'created_at',x.created_at,'updated_at',x.updated_at)) FROM student_projects x JOIN project_members m ON m.project_id=x.project_id WHERE m.student_id=s.user_id AND x.status='published' AND (x.visibility='public' OR s.user_id=$2 OR $3)),'[]'),COALESCE((SELECT jsonb_agg(jsonb_build_object('execution_id',e.execution_id,'case_id',e.case_id,'case_title',c.title,'application_id',e.application_id,'status',e.status,'members','[]'::jsonb,'created_at',e.created_at)) FROM execution_members em JOIN executions e ON e.execution_id=em.execution_id JOIN cases c ON c.case_id=e.case_id WHERE em.student_id=s.user_id AND em.left_at IS NULL AND e.status IN ('done','closed')),'[]'),COALESCE((SELECT jsonb_agg(to_jsonb(z)) FROM certificates z WHERE z.student_id=s.user_id AND z.revoked_at IS NULL),'[]'),COALESCE((SELECT jsonb_agg(jsonb_build_object('award_id',a.award_id,'execution_id',a.execution_id,'title',a.title,'place_no',a.place_no,'amount',a.amount,'currency',a.currency,'awarded_by',a.awarded_by,'awarded_at',a.awarded_at,'fulfillment_status',COALESCE(f.status,'pending'))) FROM awards a JOIN execution_members em ON em.execution_id=a.execution_id LEFT JOIN reward_fulfillments f ON f.award_id=a.award_id WHERE em.student_id=s.user_id),'[]') FROM students s LEFT JOIN portfolio_settings ps ON ps.student_id=s.user_id WHERE s.user_id=$1 AND (COALESCE(ps.visibility,'public')='public' OR s.user_id=$2 OR $3)`, student, viewer, admin).Scan(&visibility, &headline, &about, &projects, &executions, &certs, &awards)
	if e != nil {
		return nil, e
	}
	item, e := scanStudent(r.db.QueryRowContext(ctx, studentSelect+` WHERE u.user_id=$1`, student))
	if e != nil {
		return nil, e
	}
	if !admin && student != viewer && (item.CuratorID == nil || *item.CuratorID != viewer) {
		item.CuratorID = nil
	}
	p.Student = item
	p.Visibility = visibility
	p.Headline = headline
	p.About = about
	if e = json.Unmarshal(projects, &p.Projects); e != nil {
		return nil, e
	}
	if e = json.Unmarshal(executions, &p.Executions); e != nil {
		return nil, e
	}
	if e = json.Unmarshal(certs, &p.Certificates); e != nil {
		return nil, e
	}
	if e = json.Unmarshal(awards, &p.Awards); e != nil {
		return nil, e
	}
	return &p, nil
}
func (r *Repository) UpdatePortfolio(ctx context.Context, u, visibility, headline, about string) (*models.Portfolio, error) {
	_, e := r.db.ExecContext(ctx, `INSERT INTO portfolio_settings(student_id,visibility,headline,about) SELECT user_id,$2,NULLIF($3,''),NULLIF($4,'') FROM students WHERE user_id=$1 ON CONFLICT(student_id) DO UPDATE SET visibility=EXCLUDED.visibility,headline=EXCLUDED.headline,about=EXCLUDED.about`, u, visibility, headline, about)
	if e != nil {
		return nil, e
	}
	return r.GetPortfolio(ctx, u, u, false)
}
func (r *Repository) Analytics(ctx context.Context, u, company string, admin bool) (models.Analytics, error) {
	var x models.Analytics
	if company != "" {
		var ok bool
		e := r.db.QueryRowContext(ctx, `SELECT ($3 OR EXISTS(SELECT 1 FROM company_members WHERE company_id=$1 AND user_id=$2 AND status='active' AND permissions ? 'manage_company'))`, company, u, admin).Scan(&ok)
		if e != nil || !ok {
			return x, ErrForbidden
		}
		e = r.db.QueryRowContext(ctx, `SELECT (SELECT count(DISTINCT em.student_id) FROM cases c JOIN executions e ON e.case_id=c.case_id JOIN execution_members em ON em.execution_id=e.execution_id WHERE c.company_id=$1),(SELECT count(*) FROM companies WHERE company_id=$1),(SELECT count(*) FROM cases WHERE company_id=$1 AND status='published'),(SELECT count(*) FROM executions e JOIN cases c ON c.case_id=e.case_id WHERE c.company_id=$1 AND e.status NOT IN ('done','closed','cancelled')),(SELECT count(*) FROM executions e JOIN cases c ON c.case_id=e.case_id WHERE c.company_id=$1 AND e.status IN ('done','closed')),(SELECT 0),(SELECT count(*) FROM submissions s JOIN executions e ON e.execution_id=s.execution_id JOIN cases c ON c.case_id=e.case_id WHERE c.company_id=$1)`, company).Scan(&x.ActiveStudents, &x.Companies, &x.PublishedCases, &x.ActiveExecutions, &x.CompletedExecutions, &x.PublishedProjects, &x.Submissions)
		x.UpdatedAt = time.Now().UTC()
		return x, e
	}
	if !admin {
		return x, ErrForbidden
	}
	e := r.db.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM users),(SELECT count(*) FROM students s JOIN users u ON u.user_id=s.user_id WHERE u.status='active'),(SELECT count(*) FROM companies WHERE status='approved'),(SELECT count(*) FROM cases WHERE status='published'),(SELECT count(*) FROM executions WHERE status NOT IN ('done','closed','cancelled')),(SELECT count(*) FROM executions WHERE status IN ('done','closed')),(SELECT count(*) FROM student_projects WHERE status='published'),(SELECT count(*) FROM submissions)`).Scan(&x.Users, &x.ActiveStudents, &x.Companies, &x.PublishedCases, &x.ActiveExecutions, &x.CompletedExecutions, &x.PublishedProjects, &x.Submissions)
	x.UpdatedAt = time.Now().UTC()
	return x, e
}
func (r *Repository) ExportRows(ctx context.Context, u, kind, company string, admin bool) ([]models.ExportRow, error) {
	if !admin {
		var ok bool
		e := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM company_members WHERE company_id=NULLIF($1,'')::uuid AND user_id=$2 AND status='active' AND permissions ? 'manage_company')`, company, u).Scan(&ok)
		if e != nil || !ok {
			return nil, ErrForbidden
		}
	}
	var q string
	args := []any{}
	switch kind {
	case "cases":
		q = `SELECT c.case_id,c.title,c.status,co.full_name,c.created_at FROM cases c JOIN companies co ON co.company_id=c.company_id`
		if company != "" {
			q += ` WHERE c.company_id=$1`
			args = append(args, company)
		}
	case "executions":
		q = `SELECT e.execution_id,c.title,e.status,co.full_name,e.created_at FROM executions e JOIN cases c ON c.case_id=e.case_id JOIN companies co ON co.company_id=c.company_id`
		if company != "" {
			q += ` WHERE c.company_id=$1`
			args = append(args, company)
		}
	case "student-projects":
		if !admin {
			return nil, ErrForbidden
		}
		q = `SELECT p.project_id,p.title,p.status,u.username,p.created_at FROM student_projects p JOIN users u ON u.user_id=p.owner_id`
	case "users":
		if !admin {
			return nil, ErrForbidden
		}
		q = `SELECT user_id,username,status,email,created_at FROM users`
	default:
		return nil, sql.ErrNoRows
	}
	q += ` ORDER BY created_at DESC`
	rows, e := r.db.QueryContext(ctx, q, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.ExportRow{}
	for rows.Next() {
		var x models.ExportRow
		if e = rows.Scan(&x.ID, &x.Title, &x.Status, &x.Owner, &x.CreatedAt); e != nil {
			return nil, e
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) ClaimEmails(ctx context.Context, limit int) ([]models.OutboxEmail, error) {
	tx, e := r.db.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	rows, e := tx.QueryContext(ctx, `SELECT email_id,recipient,subject,body,attempts FROM email_outbox WHERE status IN ('pending','failed') AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1`, limit)
	if e != nil {
		return nil, e
	}
	out := []models.OutboxEmail{}
	for rows.Next() {
		var x models.OutboxEmail
		if e = rows.Scan(&x.EmailID, &x.Recipient, &x.Subject, &x.Body, &x.Attempts); e != nil {
			rows.Close()
			return nil, e
		}
		out = append(out, x)
	}
	rows.Close()
	for _, x := range out {
		if _, e = tx.ExecContext(ctx, `UPDATE email_outbox SET status='sending',attempts=attempts+1 WHERE email_id=$1`, x.EmailID); e != nil {
			return nil, e
		}
	}
	if e = tx.Commit(); e != nil {
		return nil, e
	}
	return out, nil
}
func (r *Repository) CompleteEmail(ctx context.Context, id string, sendErr error) error {
	if sendErr == nil {
		_, e := r.db.ExecContext(ctx, `UPDATE email_outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,last_error=NULL WHERE email_id=$1`, id)
		return e
	}
	_, e := r.db.ExecContext(ctx, `UPDATE email_outbox SET status=CASE WHEN attempts>=5 THEN 'cancelled' ELSE 'failed' END,last_error=$2,next_attempt_at=CURRENT_TIMESTAMP+(power(2,LEAST(attempts,8))||' minutes')::interval WHERE email_id=$1`, id, sendErr.Error())
	return e
}
