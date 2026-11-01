package executions_service

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"it-project-showcase/backend/internal/models"
	execution_repo "it-project-showcase/backend/internal/storage/repositories/execution"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrForbidden  = errors.New("execution access denied")
	ErrInvalid    = errors.New("invalid execution input")
	ErrTransition = errors.New("invalid execution transition")
	ErrCursor     = errors.New("invalid cursor")
)
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type Service struct{ repo *execution_repo.Repository }

func Init(r *execution_repo.Repository) *Service { return &Service{repo: r} }
func (s *Service) ListStages(ctx context.Context, u, id string, c, a bool) ([]models.ExecutionStage, error) {
	if !uuidPattern.MatchString(id) {
		return nil, ErrInvalid
	}
	return s.repo.ListStages(ctx, u, id, c, a)
}
func (s *Service) UpdateStage(ctx context.Context, u, e, stage, status, feedback string, company bool) (*models.ExecutionStage, error) {
	feedback = strings.TrimSpace(feedback)
	if !uuidPattern.MatchString(e) || !uuidPattern.MatchString(stage) || utf8.RuneCountInString(feedback) > 5000 {
		return nil, ErrInvalid
	}
	if company {
		if status != "accepted" && status != "revision" {
			return nil, ErrTransition
		}
	} else if status != "in_progress" && status != "submitted" {
		return nil, ErrTransition
	}
	x, err := s.repo.UpdateStage(ctx, u, e, stage, status, feedback, company)
	return x, mapError(err)
}
func (s *Service) AddComment(ctx context.Context, u, e, stage, body string, c, a bool) (*models.ExecutionComment, error) {
	body = strings.TrimSpace(body)
	if !uuidPattern.MatchString(e) || body == "" || utf8.RuneCountInString(body) > 5000 {
		return nil, ErrInvalid
	}
	var sid *string
	if stage != "" {
		if !uuidPattern.MatchString(stage) {
			return nil, ErrInvalid
		}
		sid = &stage
	}
	x, err := s.repo.AddComment(ctx, u, e, sid, body, c, a)
	return x, mapError(err)
}
func (s *Service) ListComments(ctx context.Context, u, e string, c, a bool, limit int, pos, id string) ([]models.ExecutionComment, error) {
	if !uuidPattern.MatchString(e) {
		return nil, ErrInvalid
	}
	var before *time.Time
	if pos != "" {
		v, err := time.Parse(time.RFC3339Nano, pos)
		if err != nil || !uuidPattern.MatchString(id) {
			return nil, ErrCursor
		}
		before = &v
	}
	return s.repo.ListComments(ctx, u, e, c, a, limit, before, id)
}
func (s *Service) AddMentor(ctx context.Context, u, e, m, role string) (*models.ExecutionMentor, error) {
	role = strings.TrimSpace(role)
	if !uuidPattern.MatchString(e) || !uuidPattern.MatchString(m) || role == "" || utf8.RuneCountInString(role) > 150 {
		return nil, ErrInvalid
	}
	x, err := s.repo.AddMentor(ctx, u, e, m, role)
	return x, mapError(err)
}
func (s *Service) ListMentors(ctx context.Context, u, e string, c, a bool) ([]models.ExecutionMentor, error) {
	if !uuidPattern.MatchString(e) {
		return nil, ErrInvalid
	}
	return s.repo.ListMentors(ctx, u, e, c, a)
}
func (s *Service) UpdateExecutionStatus(ctx context.Context, u, id, status string, company bool) (*models.Execution, error) {
	if !uuidPattern.MatchString(id) {
		return nil, ErrInvalid
	}
	if (!company && status != "in_progress") || (company && status != "cancelled" && status != "closed") {
		return nil, ErrTransition
	}
	x, err := s.repo.UpdateExecutionStatus(ctx, u, id, status, company)
	return x, mapError(err)
}
func (s *Service) ListNDA(ctx context.Context, u, caseID string, c, a bool) ([]models.NDAGrant, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrInvalid
	}
	return s.repo.ListNDA(ctx, u, caseID, c, a)
}
func (s *Service) RequestNDA(ctx context.Context, u, caseID string) (*models.NDAGrant, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrInvalid
	}
	x, err := s.repo.RequestNDA(ctx, u, caseID)
	return x, mapError(err)
}
func (s *Service) UpdateNDA(ctx context.Context, u, id, status, evidence string) (*models.NDAGrant, error) {
	if !uuidPattern.MatchString(id) || (status != "granted" && status != "rejected" && status != "revoked") || (evidence != "" && !uuidPattern.MatchString(evidence)) {
		return nil, ErrInvalid
	}
	var file *string
	if evidence != "" {
		file = &evidence
	}
	x, err := s.repo.UpdateNDA(ctx, u, id, status, file)
	return x, mapError(err)
}
func mapError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrForbidden
	}
	if errors.Is(err, execution_repo.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(err, execution_repo.ErrTransition) {
		return ErrTransition
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrTransition
	}
	return err
}
