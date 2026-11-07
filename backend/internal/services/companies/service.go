package companies_service

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"it-project-showcase/backend/internal/models"
	company_repo "it-project-showcase/backend/internal/storage/repositories/company"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrNotFound      = errors.New("company not found")
	ErrForbidden     = errors.New("company access denied")
	ErrInvalidInput  = errors.New("invalid company input")
	ErrInvalidStatus = errors.New("invalid company status")
	ErrNameTaken     = errors.New("company name is already in use")
	ErrInvalidCursor = errors.New("invalid company cursor")
)
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type Service struct{ repo *company_repo.Repository }

func Init(repo *company_repo.Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context, limit int, position, id string) ([]models.Company, error) {
	return s.list(ctx, "approved", limit, position, id)
}
func (s *Service) Submit(ctx context.Context, userID, companyID string) (*models.Company, error) {
	if !uuidPattern.MatchString(companyID) {
		return nil, ErrNotFound
	}
	x, err := s.repo.Submit(ctx, userID, companyID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrInvalidStatus
	}
	return x, mapRepositoryError(err)
}
func (s *Service) InviteMember(ctx context.Context, userID, companyID, targetID, position string) (*models.CompanyMemberInvitation, error) {
	position = strings.TrimSpace(position)
	if !uuidPattern.MatchString(companyID) || !uuidPattern.MatchString(targetID) || userID == targetID || utf8.RuneCountInString(position) > 150 {
		return nil, ErrInvalidInput
	}
	x, err := s.repo.InviteMember(ctx, userID, companyID, targetID, position)
	return x, mapRepositoryError(err)
}
func (s *Service) RespondMemberInvitation(ctx context.Context, userID, id, status string) (*models.Company, error) {
	if !uuidPattern.MatchString(id) || (status != "accepted" && status != "declined") {
		return nil, ErrInvalidInput
	}
	x, err := s.repo.RespondMemberInvitation(ctx, userID, id, status)
	return x, mapRepositoryError(err)
}
func (s *Service) SendStudentInvitation(ctx context.Context, userID, companyID, studentID, caseID, kind, message string) (*models.CompanyInvitation, error) {
	message = strings.TrimSpace(message)
	if !uuidPattern.MatchString(companyID) || !uuidPattern.MatchString(studentID) || (caseID != "" && !uuidPattern.MatchString(caseID)) || !oneOf(kind, "case", "internship", "interview", "job") || utf8.RuneCountInString(message) > 3000 {
		return nil, ErrInvalidInput
	}
	x, err := s.repo.SendStudentInvitation(ctx, userID, companyID, studentID, caseID, kind, message)
	return x, mapRepositoryError(err)
}
func (s *Service) RespondStudentInvitation(ctx context.Context, userID, id, status string) (*models.CompanyInvitation, error) {
	if !uuidPattern.MatchString(id) || (status != "accepted" && status != "declined") {
		return nil, ErrInvalidInput
	}
	x, err := s.repo.RespondStudentInvitation(ctx, userID, id, status)
	return x, mapRepositoryError(err)
}
func (s *Service) ListMemberInvitations(ctx context.Context, userID, status string, limit int, position, id string) ([]models.CompanyMemberInvitation, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		status = "pending"
	}
	if !oneOf(status, "pending", "accepted", "declined", "revoked") {
		return nil, ErrInvalidStatus
	}
	before, err := companyCursor(position, id)
	if err != nil {
		return nil, err
	}
	return s.repo.ListMemberInvitations(ctx, userID, status, limit, before, id)
}
func (s *Service) ListStudentInvitations(ctx context.Context, userID, status string, limit int, position, id string) ([]models.CompanyInvitation, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		status = "sent"
	}
	if !oneOf(status, "sent", "accepted", "declined", "expired", "revoked") {
		return nil, ErrInvalidStatus
	}
	before, err := companyCursor(position, id)
	if err != nil {
		return nil, err
	}
	return s.repo.ListStudentInvitations(ctx, userID, status, limit, before, id)
}
func companyCursor(position, id string) (*time.Time, error) {
	if position == "" {
		return nil, nil
	}
	v, err := time.Parse(time.RFC3339Nano, position)
	if err != nil || !uuidPattern.MatchString(id) {
		return nil, ErrInvalidCursor
	}
	return &v, nil
}
func oneOf(v string, a ...string) bool {
	for _, x := range a {
		if v == x {
			return true
		}
	}
	return false
}
func (s *Service) ListForModeration(ctx context.Context, status string, limit int, position, id string) ([]models.Company, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "approved" && status != "rejected" && status != "suspended" {
		return nil, ErrInvalidStatus
	}
	return s.list(ctx, status, limit, position, id)
}
func (s *Service) list(ctx context.Context, status string, limit int, position, id string) ([]models.Company, error) {
	return s.listScope(ctx, status, "", limit, position, id)
}

func (s *Service) ListMine(ctx context.Context, userID string, limit int, position, id string) ([]models.Company, error) {
	return s.listScope(ctx, "", userID, limit, position, id)
}

func (s *Service) listScope(ctx context.Context, status, owner string, limit int, position, id string) ([]models.Company, error) {
	var before *time.Time
	if position != "" {
		value, err := time.Parse(time.RFC3339Nano, position)
		if err != nil || !uuidPattern.MatchString(id) {
			return nil, ErrInvalidCursor
		}
		before = &value
	}
	if owner != "" {
		return s.repo.ListMine(ctx, owner, limit, before, id)
	}
	return s.repo.List(ctx, status, limit, before, id)
}
func (s *Service) Get(ctx context.Context, companyID string) (*models.Company, error) {
	if !uuidPattern.MatchString(companyID) {
		return nil, ErrNotFound
	}
	company, err := s.repo.GetApproved(ctx, companyID)
	return company, mapRepositoryError(err)
}
func (s *Service) Create(ctx context.Context, userID string, input models.CompanyInput) (*models.Company, error) {
	input = normalize(input)
	if err := validate(input); err != nil {
		return nil, err
	}
	company, err := s.repo.Create(ctx, userID, input)
	return company, mapRepositoryError(err)
}
func (s *Service) Update(ctx context.Context, userID, companyID string, input models.CompanyInput) (*models.Company, error) {
	if !uuidPattern.MatchString(companyID) {
		return nil, ErrNotFound
	}
	input = normalize(input)
	if err := validate(input); err != nil {
		return nil, err
	}
	company, err := s.repo.UpdateByMember(ctx, userID, companyID, input)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return company, mapRepositoryError(err)
}
func (s *Service) Moderate(ctx context.Context, moderatorID, companyID, status, comment string) (*models.Company, error) {
	if !uuidPattern.MatchString(companyID) {
		return nil, ErrNotFound
	}
	status, comment = strings.TrimSpace(status), strings.TrimSpace(comment)
	if status != "approved" && status != "rejected" && status != "suspended" {
		return nil, ErrInvalidStatus
	}
	if utf8.RuneCountInString(comment) > 2000 {
		return nil, ErrInvalidInput
	}
	company, err := s.repo.Moderate(ctx, moderatorID, companyID, status, comment)
	return company, mapRepositoryError(err)
}

func normalize(input models.CompanyInput) models.CompanyInput {
	input.FullName = strings.TrimSpace(input.FullName)
	input.ShortName = strings.TrimSpace(input.ShortName)
	input.Industry = strings.TrimSpace(input.Industry)
	input.Description = strings.TrimSpace(input.Description)
	input.Activities = strings.TrimSpace(input.Activities)
	input.Website = strings.TrimSpace(input.Website)
	input.Contacts = strings.TrimSpace(input.Contacts)
	input.Position = strings.TrimSpace(input.Position)
	return input
}
func validate(input models.CompanyInput) error {
	if input.FullName == "" || utf8.RuneCountInString(input.FullName) > 300 || utf8.RuneCountInString(input.ShortName) > 100 || utf8.RuneCountInString(input.Industry) > 150 || utf8.RuneCountInString(input.Description) > 5000 || utf8.RuneCountInString(input.Activities) > 3000 || utf8.RuneCountInString(input.Contacts) > 1000 || utf8.RuneCountInString(input.Position) > 150 {
		return ErrInvalidInput
	}
	if input.Website != "" {
		parsed, err := url.ParseRequestURI(input.Website)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return ErrInvalidInput
		}
	}
	return nil
}
func mapRepositoryError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if errors.Is(err, company_repo.ErrInvalidTransition) {
		return ErrInvalidStatus
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrNameTaken
	}
	return err
}
