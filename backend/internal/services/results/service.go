package results_service

import (
	"context"
	"database/sql"
	"errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"it-project-showcase/backend/internal/models"
	result_repo "it-project-showcase/backend/internal/storage/repositories/result"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalid   = errors.New("invalid result input")
	ErrForbidden = errors.New("result access denied")
	ErrNotFound  = errors.New("result not found")
	ErrCursor    = errors.New("invalid cursor")
	ErrConflict  = errors.New("result conflict")
)

type Service struct{ repo *result_repo.Repository }

func Init(r *result_repo.Repository) *Service { return &Service{r} }
func validID(x string) bool                   { _, e := uuid.Parse(x); return e == nil }
func roles(c, a bool) (bool, bool)            { return c, a }
func (s *Service) ListSubmissions(ctx context.Context, u, e string, c, a bool, limit int, pos, id string) ([]models.Submission, error) {
	if !validID(e) {
		return nil, ErrInvalid
	}
	var before *time.Time
	if pos != "" {
		x, er := time.Parse(time.RFC3339Nano, pos)
		if er != nil || !validID(id) {
			return nil, ErrCursor
		}
		before = &x
	}
	return s.repo.ListSubmissions(ctx, u, e, c, a, limit, before, id)
}
func (s *Service) GetSubmission(ctx context.Context, u, id string, c, a bool) (*models.Submission, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	x, e := s.repo.GetSubmission(ctx, u, id, c, a)
	return x, mapErr(e, true)
}

func (s *Service) ReviewDetails(ctx context.Context, user, submission string, company, admin bool) (*models.ResultReviewDetails, error) {
	if !validID(submission) {
		return nil, ErrNotFound
	}
	item, err := s.repo.ReviewDetails(ctx, user, submission, company, admin)
	return item, mapErr(err, true)
}
func (s *Service) CreateSubmission(ctx context.Context, u, e string, in models.SubmissionInput) (*models.Submission, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	if !validID(e) || in.Title == "" || in.Description == "" || utf8.RuneCountInString(in.Title) > 200 || utf8.RuneCountInString(in.Description) > 20000 || (in.Kind != "stage" && in.Kind != "final") || (in.Kind == "stage" && !validID(in.StageID)) || len(in.Files) > 30 {
		return nil, ErrInvalid
	}
	for i := range in.Files {
		if !validID(in.Files[i].FileID) || in.Files[i].Ordinal < 1 || (in.Files[i].Kind != "attachment" && in.Files[i].Kind != "screenshot" && in.Files[i].Kind != "presentation" && in.Files[i].Kind != "documentation" && in.Files[i].Kind != "source_archive") {
			return nil, ErrInvalid
		}
	}
	x, er := s.repo.CreateSubmission(ctx, u, e, in)
	return x, mapErr(er, false)
}
func (s *Service) ListEvaluations(ctx context.Context, u, id string, c, a bool) ([]models.Evaluation, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	x, e := s.repo.ListEvaluations(ctx, u, id, c, a)
	return x, mapErr(e, false)
}
func (s *Service) GetEvaluation(ctx context.Context, u, id string, c, a bool) (*models.Evaluation, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	x, e := s.repo.GetEvaluation(ctx, u, id, c, a)
	return x, mapErr(e, true)
}
func (s *Service) CreateEvaluation(ctx context.Context, u, id string, in models.EvaluationInput) (*models.Evaluation, error) {
	if !validID(id) || len(in.Scores) == 0 || len(in.Scores) > 50 || utf8.RuneCountInString(in.Feedback) > 10000 {
		return nil, ErrInvalid
	}
	seen := map[string]bool{}
	for _, x := range in.Scores {
		if !validID(x.CriterionID) || x.Score < 0 || seen[x.CriterionID] {
			return nil, ErrInvalid
		}
		seen[x.CriterionID] = true
	}
	x, e := s.repo.CreateEvaluation(ctx, u, id, in)
	return x, mapErr(e, false)
}
func (s *Service) AddReview(ctx context.Context, u, id, d, b string) (*models.Review, error) {
	b = strings.TrimSpace(b)
	if !validID(id) || (d != "accept" && d != "request_revision" && d != "comment") || b == "" || utf8.RuneCountInString(b) > 10000 {
		return nil, ErrInvalid
	}
	x, e := s.repo.AddReview(ctx, u, id, d, b)
	return x, mapErr(e, false)
}
func (s *Service) ListReviews(ctx context.Context, u, id string, c, a bool) ([]models.Review, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	x, e := s.repo.ListReviews(ctx, u, id, c, a)
	return x, mapErr(e, false)
}
func (s *Service) ListAwards(ctx context.Context, u, e string, c, a bool) ([]models.Award, error) {
	if !validID(e) {
		return nil, ErrInvalid
	}
	x, er := s.repo.ListAwards(ctx, u, e, c, a)
	return x, mapErr(er, false)
}
func (s *Service) CreateAward(ctx context.Context, u, e, title string, place *int, amount *float64, currency *string) (*models.Award, error) {
	title = strings.TrimSpace(title)
	if !validID(e) || title == "" || utf8.RuneCountInString(title) > 200 || (place != nil && *place < 1) || (amount != nil && *amount < 0) || (currency != nil && len(*currency) != 3) {
		return nil, ErrInvalid
	}
	x, er := s.repo.CreateAward(ctx, u, e, title, place, amount, currency)
	return x, mapErr(er, false)
}
func (s *Service) UpdateFulfillment(ctx context.Context, u, id, status, comment, evidence string) (*models.Award, error) {
	if !validID(id) || (status != "pending" && status != "in_progress" && status != "fulfilled" && status != "cancelled") || (evidence != "" && !validID(evidence)) {
		return nil, ErrInvalid
	}
	var f *string
	if evidence != "" {
		f = &evidence
	}
	x, e := s.repo.UpdateFulfillment(ctx, u, id, status, comment, f)
	return x, mapErr(e, false)
}
func (s *Service) ListCertificates(ctx context.Context, u, e string, c, a bool) ([]models.Certificate, error) {
	if !validID(e) {
		return nil, ErrInvalid
	}
	x, er := s.repo.ListCertificates(ctx, u, e, c, a)
	return x, mapErr(er, false)
}
func (s *Service) CreateCertificate(ctx context.Context, u, e, student, file, code string) (*models.Certificate, error) {
	code = strings.TrimSpace(code)
	if !validID(e) || !validID(student) || !validID(file) || code == "" || len(code) > 100 {
		return nil, ErrInvalid
	}
	x, er := s.repo.CreateCertificate(ctx, u, e, student, file, code)
	return x, mapErr(er, false)
}
func mapErr(e error, notFound bool) error {
	if e == nil {
		return nil
	}
	if errors.Is(e, result_repo.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(e, result_repo.ErrIncompleteScores) {
		return ErrInvalid
	}
	if errors.Is(e, sql.ErrNoRows) {
		if notFound {
			return ErrNotFound
		}
		return ErrForbidden
	}
	var pgErr *pgconn.PgError
	if errors.As(e, &pgErr) {
		if pgErr.Code == "23505" {
			return ErrConflict
		}
		if pgErr.Code == "23503" || pgErr.Code == "23514" || pgErr.Code == "P0001" {
			return ErrInvalid
		}
	}
	return e
}
