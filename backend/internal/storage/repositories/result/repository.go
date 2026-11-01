package result_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/models"
	"time"
)

var ErrForbidden = errors.New("result access denied")

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }
func (r *Repository) authorize(ctx context.Context, u, e string, c, a bool) error {
	var ok bool
	err := r.db.QueryRowContext(ctx, `SELECT ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=x.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM cases k JOIN company_members cm ON cm.company_id=k.company_id WHERE k.case_id=x.case_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))) FROM executions x WHERE x.execution_id=$1`, e, u, c, a).Scan(&ok)
	if errors.Is(err, sql.ErrNoRows) || !ok {
		return ErrForbidden
	}
	return err
}

const subSelect = `SELECT s.submission_id,s.execution_id,s.stage_id,s.version_no,s.kind,s.title,s.description,s.repository_url,s.demo_url,s.status,s.submitted_by,s.submitted_at,s.reviewed_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('file_id',f.file_id,'kind',f.kind,'ordinal',f.ordinal) ORDER BY f.ordinal,f.file_id) FROM submission_files f WHERE f.submission_id=s.submission_id),'[]'::jsonb) FROM submissions s`

func scanSub(row interface{ Scan(...any) error }) (*models.Submission, error) {
	var x models.Submission
	var repo, demo sql.NullString
	var raw []byte
	err := row.Scan(&x.SubmissionID, &x.ExecutionID, &x.StageID, &x.VersionNo, &x.Kind, &x.Title, &x.Description, &repo, &demo, &x.Status, &x.SubmittedBy, &x.SubmittedAt, &x.ReviewedAt, &raw)
	x.RepositoryURL = repo.String
	x.DemoURL = demo.String
	if err == nil {
		err = json.Unmarshal(raw, &x.Files)
	}
	return &x, err
}
func (r *Repository) ListSubmissions(ctx context.Context, u, e string, c, a bool, limit int, before *time.Time, bid string) ([]models.Submission, error) {
	if err := r.authorize(ctx, u, e, c, a); err != nil {
		return nil, err
	}
	q := subSelect + ` WHERE s.execution_id=$1`
	args := []any{e}
	if before != nil {
		args = append(args, *before, bid)
		q += fmt.Sprintf(` AND (s.submitted_at,s.submission_id)<($%d,$%d)`, len(args)-1, len(args))
	}
	args = append(args, limit)
	q += fmt.Sprintf(` ORDER BY s.submitted_at DESC,s.submission_id DESC LIMIT $%d`, len(args))
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Submission{}
	for rows.Next() {
		x, er := scanSub(rows)
		if er != nil {
			return nil, er
		}
		out = append(out, *x)
	}
	return out, rows.Err()
}
func (r *Repository) GetSubmission(ctx context.Context, u, id string, c, a bool) (*models.Submission, error) {
	x, err := scanSub(r.db.QueryRowContext(ctx, subSelect+` JOIN executions e ON e.execution_id=s.execution_id WHERE s.submission_id=$1 AND ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM cases k JOIN company_members cm ON cm.company_id=k.company_id WHERE k.case_id=e.case_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')))`, id, u, c, a))
	if errors.Is(err, sql.ErrNoRows) {
		var exists bool
		if e := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM submissions WHERE submission_id=$1)`, id).Scan(&exists); e == nil && exists {
			return nil, ErrForbidden
		}
	}
	return x, err
}
func (r *Repository) CreateSubmission(ctx context.Context, u, e string, in models.SubmissionInput) (*models.Submission, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var id string
	var stage any
	if in.StageID != "" {
		stage = in.StageID
	}
	err = tx.QueryRowContext(ctx, `INSERT INTO submissions(execution_id,stage_id,version_no,kind,title,description,repository_url,demo_url,submitted_by) SELECT x.execution_id,$3,COALESCE((SELECT max(version_no)+1 FROM submissions WHERE execution_id=x.execution_id),1),$4,$5,$6,NULLIF($7,''),NULLIF($8,''),$2 FROM executions x WHERE x.execution_id=$1 AND x.status IN ('in_progress','revision','done') AND EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=x.execution_id AND m.student_id=$2 AND m.left_at IS NULL) RETURNING submission_id`, e, u, stage, in.Kind, in.Title, in.Description, in.RepositoryURL, in.DemoURL).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	for _, f := range in.Files {
		res, er := tx.ExecContext(ctx, `INSERT INTO submission_files(submission_id,file_id,kind,ordinal) SELECT $1,file_id,$3,$4 FROM files WHERE file_id=$2 AND uploaded_by=$5 AND status='active'`, id, f.FileID, f.Kind, f.Ordinal, u)
		if er != nil {
			return nil, er
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return nil, ErrForbidden
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE submissions SET status='superseded' WHERE execution_id=$1 AND submission_id<>$2 AND kind=$3 AND status IN ('submitted','revision')`, e, id, in.Kind)
	if err == nil && in.Kind == "final" {
		_, err = tx.ExecContext(ctx, `UPDATE executions SET status='submitted' WHERE execution_id=$1`, e)
	}
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetSubmission(ctx, u, id, false, false)
}

const evalSelect = `SELECT v.evaluation_id,v.submission_id,v.evaluator_id,v.status,v.total_score,v.feedback,v.created_at,v.published_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('criterion_id',cs.criterion_id,'name',ec.name,'score',cs.score,'max_score',ec.max_score,'comment',COALESCE(cs.comment,'')) ORDER BY ec.ordinal) FROM criterion_scores cs JOIN evaluation_criteria ec ON ec.criterion_id=cs.criterion_id WHERE cs.evaluation_id=v.evaluation_id),'[]'::jsonb) FROM evaluations v`

func scanEval(row interface{ Scan(...any) error }) (*models.Evaluation, error) {
	var x models.Evaluation
	var fb sql.NullString
	var raw []byte
	err := row.Scan(&x.EvaluationID, &x.SubmissionID, &x.EvaluatorID, &x.Status, &x.TotalScore, &fb, &x.CreatedAt, &x.PublishedAt, &raw)
	x.Feedback = fb.String
	if err == nil {
		err = json.Unmarshal(raw, &x.Scores)
	}
	return &x, err
}
func (r *Repository) ListEvaluations(ctx context.Context, u, id string, c, a bool) ([]models.Evaluation, error) {
	if _, err := r.GetSubmission(ctx, u, id, c, a); err != nil {
		return nil, ErrForbidden
	}
	rows, err := r.db.QueryContext(ctx, evalSelect+` WHERE v.submission_id=$1 AND v.status='published' ORDER BY v.created_at DESC`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Evaluation{}
	for rows.Next() {
		x, er := scanEval(rows)
		if er != nil {
			return nil, er
		}
		out = append(out, *x)
	}
	return out, rows.Err()
}
func (r *Repository) GetEvaluation(ctx context.Context, u, id string, c, a bool) (*models.Evaluation, error) {
	x, err := scanEval(r.db.QueryRowContext(ctx, evalSelect+` JOIN submissions s ON s.submission_id=v.submission_id JOIN executions e ON e.execution_id=s.execution_id WHERE v.evaluation_id=$1 AND ($4 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL) OR ($3 AND EXISTS(SELECT 1 FROM cases k JOIN company_members cm ON cm.company_id=k.company_id WHERE k.case_id=e.case_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company')))`, id, u, c, a))
	if errors.Is(err, sql.ErrNoRows) {
		var exists bool
		if e := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM evaluations WHERE evaluation_id=$1)`, id).Scan(&exists); e == nil && exists {
			return nil, ErrForbidden
		}
	}
	return x, err
}
func (r *Repository) CreateEvaluation(ctx context.Context, u, sid string, in models.EvaluationInput) (*models.Evaluation, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var id string
	err = tx.QueryRowContext(ctx, `INSERT INTO evaluations(submission_id,evaluator_id,status,feedback,published_at) SELECT s.submission_id,$2,'published',NULLIF($3,''),CURRENT_TIMESTAMP FROM submissions s JOIN executions e ON e.execution_id=s.execution_id JOIN cases c ON c.case_id=e.case_id WHERE s.submission_id=$1 AND s.status IN ('submitted','revision') AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING evaluation_id`, sid, u, in.Feedback).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	for _, s := range in.Scores {
		if _, err = tx.ExecContext(ctx, `INSERT INTO criterion_scores(evaluation_id,criterion_id,score,comment) VALUES($1,$2,$3,NULLIF($4,''))`, id, s.CriterionID, s.Score, s.Comment); err != nil {
			return nil, err
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE evaluations SET total_score=COALESCE((SELECT sum(cs.score*ec.weight) FROM criterion_scores cs JOIN evaluation_criteria ec ON ec.criterion_id=cs.criterion_id WHERE cs.evaluation_id=$1),0) WHERE evaluation_id=$1`, id)
	if err == nil {
		_, err = tx.ExecContext(ctx, `UPDATE submissions SET status='accepted',reviewed_at=CURRENT_TIMESTAMP WHERE submission_id=$1`, sid)
	}
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetEvaluation(ctx, u, id, true, false)
}
func (r *Repository) AddReview(ctx context.Context, u, sid, decision, body string) (*models.Review, error) {
	var x models.Review
	err := r.db.QueryRowContext(ctx, `INSERT INTO reviews(submission_id,author_id,decision,body) SELECT s.submission_id,$2,$3,$4 FROM submissions s JOIN executions e ON e.execution_id=s.execution_id JOIN cases c ON c.case_id=e.case_id WHERE s.submission_id=$1 AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING review_id,submission_id,author_id,decision,body,created_at`, sid, u, decision, body).Scan(&x.ReviewID, &x.SubmissionID, &x.AuthorID, &x.Decision, &x.Body, &x.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err == nil && decision != "comment" {
		st := "accepted"
		if decision == "request_revision" {
			st = "revision"
		}
		_, err = r.db.ExecContext(ctx, `UPDATE submissions SET status=$2,reviewed_at=CURRENT_TIMESTAMP WHERE submission_id=$1`, sid, st)
	}
	return &x, err
}
func (r *Repository) ListReviews(ctx context.Context, u, sid string, c, a bool) ([]models.Review, error) {
	if _, err := r.GetSubmission(ctx, u, sid, c, a); err != nil {
		return nil, ErrForbidden
	}
	rows, err := r.db.QueryContext(ctx, `SELECT review_id,submission_id,author_id,decision,body,created_at FROM reviews WHERE submission_id=$1 ORDER BY created_at DESC`, sid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Review{}
	for rows.Next() {
		var x models.Review
		if err = rows.Scan(&x.ReviewID, &x.SubmissionID, &x.AuthorID, &x.Decision, &x.Body, &x.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) ListAwards(ctx context.Context, u, e string, c, a bool) ([]models.Award, error) {
	if err := r.authorize(ctx, u, e, c, a); err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT a.award_id,a.execution_id,a.title,a.place_no,a.amount,a.currency,a.awarded_by,a.awarded_at,COALESCE(f.status,'pending'),f.evidence_file_id FROM awards a LEFT JOIN reward_fulfillments f ON f.award_id=a.award_id WHERE a.execution_id=$1 ORDER BY a.awarded_at`, e)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Award{}
	for rows.Next() {
		var x models.Award
		if err = rows.Scan(&x.AwardID, &x.ExecutionID, &x.Title, &x.PlaceNo, &x.Amount, &x.Currency, &x.AwardedBy, &x.AwardedAt, &x.FulfillmentStatus, &x.EvidenceFileID); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) CreateAward(ctx context.Context, u, e, title string, place *int, amount *float64, currency *string) (*models.Award, error) {
	var x models.Award
	err := r.db.QueryRowContext(ctx, `INSERT INTO awards(execution_id,title,place_no,amount,currency,awarded_by) SELECT x.execution_id,$3,$4,$5,$6,$2 FROM executions x JOIN cases c ON c.case_id=x.case_id WHERE x.execution_id=$1 AND x.status IN ('done','closed') AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING award_id,execution_id,title,place_no,amount,currency,awarded_by,awarded_at`, e, u, title, place, amount, currency).Scan(&x.AwardID, &x.ExecutionID, &x.Title, &x.PlaceNo, &x.Amount, &x.Currency, &x.AwardedBy, &x.AwardedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err == nil {
		_, err = r.db.ExecContext(ctx, `INSERT INTO reward_fulfillments(award_id) VALUES($1)`, x.AwardID)
	}
	x.FulfillmentStatus = "pending"
	return &x, err
}
func (r *Repository) UpdateFulfillment(ctx context.Context, u, id, status, comment string, evidence *string) (*models.Award, error) {
	var execution string
	err := r.db.QueryRowContext(ctx, `UPDATE reward_fulfillments f SET status=$3,comment=NULLIF($4,''),evidence_file_id=$5,fulfilled_at=CASE WHEN $3='fulfilled' THEN CURRENT_TIMESTAMP ELSE NULL END FROM awards a JOIN executions e ON e.execution_id=a.execution_id JOIN cases c ON c.case_id=e.case_id WHERE f.award_id=$1 AND a.award_id=f.award_id AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') AND ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM files x WHERE x.file_id=$5 AND x.uploaded_by=$2 AND x.status='active')) RETURNING a.execution_id`, id, u, status, comment, evidence).Scan(&execution)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, err
	}
	xs, err := r.ListAwards(ctx, u, execution, true, false)
	for _, x := range xs {
		if x.AwardID == id {
			return &x, err
		}
	}
	return nil, sql.ErrNoRows
}
func (r *Repository) ListCertificates(ctx context.Context, u, e string, c, a bool) ([]models.Certificate, error) {
	if err := r.authorize(ctx, u, e, c, a); err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT certificate_id,execution_id,student_id,file_id,verification_code,issued_by,issued_at,revoked_at FROM certificates WHERE execution_id=$1 ORDER BY issued_at`, e)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Certificate{}
	for rows.Next() {
		var x models.Certificate
		if err = rows.Scan(&x.CertificateID, &x.ExecutionID, &x.StudentID, &x.FileID, &x.VerificationCode, &x.IssuedBy, &x.IssuedAt, &x.RevokedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (r *Repository) CreateCertificate(ctx context.Context, u, e, student, file, code string) (*models.Certificate, error) {
	var x models.Certificate
	err := r.db.QueryRowContext(ctx, `INSERT INTO certificates(execution_id,student_id,file_id,verification_code,issued_by) SELECT x.execution_id,$3,$4,$5,$2 FROM executions x JOIN cases c ON c.case_id=x.case_id WHERE x.execution_id=$1 AND x.status IN ('done','closed') AND EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=x.execution_id AND m.student_id=$3) AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') AND EXISTS(SELECT 1 FROM files f WHERE f.file_id=$4 AND f.uploaded_by=$2 AND f.status='active') RETURNING certificate_id,execution_id,student_id,file_id,verification_code,issued_by,issued_at,revoked_at`, e, u, student, file, code).Scan(&x.CertificateID, &x.ExecutionID, &x.StudentID, &x.FileID, &x.VerificationCode, &x.IssuedBy, &x.IssuedAt, &x.RevokedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return &x, err
}
