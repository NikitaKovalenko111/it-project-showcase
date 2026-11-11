package applications_service

import (
	"context"
	"database/sql"
	"errors"
	"github.com/jackc/pgx/v5/pgconn"
	"it-project-showcase/backend/internal/models"
	application_repo "it-project-showcase/backend/internal/storage/repositories/application"
	"it-project-showcase/backend/pkg"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrNotFound          = errors.New("application not found")
	ErrForbidden         = errors.New("application access denied")
	ErrInvalidInput      = errors.New("invalid application input")
	ErrInvalidTransition = errors.New("invalid application transition")
	ErrCaseUnavailable   = errors.New("case unavailable")
	ErrConsentPending    = errors.New("application consent pending")
	ErrConflict          = errors.New("application conflict")
	ErrInvalidCursor     = errors.New("invalid cursor")
	ErrEventCapacity     = errors.New("event capacity reached")
	ErrWrongEntryKind    = errors.New("wrong entry route for event format")
)
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type Service struct{ repo *application_repo.Repository }

func Init(repo *application_repo.Repository) *Service { return &Service{repo: repo} }
func (s *Service) Create(ctx context.Context, userID string, input models.ApplicationInput) (*models.Application, error) {
	input.CaseID = strings.TrimSpace(input.CaseID)
	input.ApplicantType = strings.TrimSpace(input.ApplicantType)
	input.TeamID = strings.TrimSpace(input.TeamID)
	input.CoverLetter = strings.TrimSpace(input.CoverLetter)
	input.ResumeFileID = strings.TrimSpace(input.ResumeFileID)
	input.PortfolioURL = strings.TrimSpace(input.PortfolioURL)
	input.GithubURL = strings.TrimSpace(input.GithubURL)
	if !uuidPattern.MatchString(input.CaseID) || (input.ApplicantType != "individual" && input.ApplicantType != "team") || (input.ApplicantType == "team") != uuidPattern.MatchString(input.TeamID) || (input.ResumeFileID != "" && !uuidPattern.MatchString(input.ResumeFileID)) || utf8.RuneCountInString(input.CoverLetter) > 5000 || !validURL(input.PortfolioURL) || !validURL(input.GithubURL) {
		return nil, ErrInvalidInput
	}
	item, err := s.repo.Create(ctx, userID, input)
	return item, mapError(err)
}
func (s *Service) Get(ctx context.Context, userID, id string, isCompany, isAdmin bool) (*models.Application, error) {
	if !uuidPattern.MatchString(id) {
		return nil, ErrNotFound
	}
	item, err := s.repo.Get(ctx, userID, id, isCompany, isAdmin)
	return item, mapError(err)
}
func (s *Service) List(ctx context.Context, userID string, isCompany, isAdmin bool, filter models.ApplicationListFilter, limit int, position, id string) ([]models.Application, error) {
	if filter.CaseID != "" && !uuidPattern.MatchString(filter.CaseID) {
		return nil, ErrInvalidInput
	}
	if filter.Status != "" && !oneOf(filter.Status, "consent_pending", "submitted", "info_requested", "interview", "accepted", "rejected", "withdrawn") {
		return nil, ErrInvalidInput
	}
	var before *time.Time
	if position != "" {
		value, err := time.Parse(time.RFC3339Nano, position)
		if err != nil || !uuidPattern.MatchString(id) {
			return nil, ErrInvalidCursor
		}
		before = &value
	}
	return s.repo.List(ctx, userID, isCompany, isAdmin, filter, limit, before, id)
}
func (s *Service) Consent(ctx context.Context, userID, id string) (*models.Application, error) {
	if !uuidPattern.MatchString(id) {
		return nil, ErrNotFound
	}
	item, err := s.repo.Consent(ctx, userID, id)
	return item, mapError(err)
}
func (s *Service) SetStatus(ctx context.Context, userID, id, status, notes string, companyActor bool) (*models.Application, error) {
	status = strings.TrimSpace(status)
	notes = strings.TrimSpace(notes)
	if !uuidPattern.MatchString(id) || utf8.RuneCountInString(notes) > 3000 || (!companyActor && status != "withdrawn") || (companyActor && !oneOf(status, "info_requested", "interview", "accepted", "rejected")) {
		return nil, ErrInvalidInput
	}
	item, err := s.repo.SetStatus(ctx, userID, id, status, notes, companyActor)
	return item, mapError(err)
}
func (s *Service) GetExecution(ctx context.Context, userID, id string, isCompany, isAdmin bool) (*models.Execution, error) {
	if !uuidPattern.MatchString(id) {
		return nil, ErrNotFound
	}
	item, err := s.repo.GetExecution(ctx, userID, id, isCompany, isAdmin)
	return item, mapError(err)
}

func (s *Service) ListExecutions(ctx context.Context, userID string, isCompany, isAdmin bool, limit int, position, id string) ([]models.Execution, error) {
	var before *time.Time
	if position != "" {
		value, err := time.Parse(time.RFC3339Nano, position)
		if err != nil || !uuidPattern.MatchString(id) {
			return nil, ErrInvalidCursor
		}
		before = &value
	}
	return s.repo.ListExecutions(ctx, userID, isCompany, isAdmin, limit, before, id)
}
func validURL(value string) bool {
	return value == "" || pkg.IsWebURL(value)
}
func oneOf(value string, allowed ...string) bool {
	for _, x := range allowed {
		if value == x {
			return true
		}
	}
	return false
}
func mapError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if errors.Is(err, application_repo.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(err, application_repo.ErrInvalidTransition) {
		return ErrInvalidTransition
	}
	if errors.Is(err, application_repo.ErrCaseUnavailable) {
		return ErrCaseUnavailable
	}
	if errors.Is(err, application_repo.ErrConsentPending) {
		return ErrConsentPending
	}
	if errors.Is(err, application_repo.ErrEventCapacity) {
		return ErrEventCapacity
	}
	if errors.Is(err, application_repo.ErrWrongEntryKind) {
		return ErrWrongEntryKind
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}
