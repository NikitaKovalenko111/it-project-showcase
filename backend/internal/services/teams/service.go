package teams_service

import (
	"context"
	"database/sql"
	"errors"
	"github.com/jackc/pgx/v5/pgconn"
	"it-project-showcase/backend/internal/models"
	team_repo "it-project-showcase/backend/internal/storage/repositories/team"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrNotFound          = errors.New("team not found")
	ErrForbidden         = errors.New("team access denied")
	ErrInvalidInput      = errors.New("invalid team input")
	ErrInvalidTransition = errors.New("invalid invitation transition")
	ErrConflict          = errors.New("team conflict")
	ErrInvalidCursor     = errors.New("invalid cursor")
)
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type Service struct{ repo *team_repo.Repository }

func Init(repo *team_repo.Repository) *Service { return &Service{repo: repo} }
func (s *Service) Create(ctx context.Context, userID, name string) (*models.Team, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 200 {
		return nil, ErrInvalidInput
	}
	item, err := s.repo.Create(ctx, userID, name)
	return item, mapError(err)
}
func (s *Service) Get(ctx context.Context, userID, teamID string, admin bool) (*models.Team, error) {
	if !uuidPattern.MatchString(teamID) {
		return nil, ErrNotFound
	}
	item, err := s.repo.Get(ctx, userID, teamID, admin)
	return item, mapError(err)
}
func (s *Service) Invite(ctx context.Context, userID, teamID, studentID, roleID string) (*models.TeamInvitation, error) {
	if !uuidPattern.MatchString(teamID) || !uuidPattern.MatchString(studentID) || (roleID != "" && !uuidPattern.MatchString(roleID)) || userID == studentID {
		return nil, ErrInvalidInput
	}
	var role *string
	if roleID != "" {
		role = &roleID
	}
	item, err := s.repo.Invite(ctx, userID, teamID, studentID, role)
	return item, mapError(err)
}
func (s *Service) ListMine(ctx context.Context, userID string, limit int, offset int64) ([]models.Team, int64, error) {
	return s.repo.ListMine(ctx, userID, limit, offset)
}

func (s *Service) ListInvitations(ctx context.Context, userID, status string, limit int, position, id string) ([]models.TeamInvitation, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "accepted" && status != "declined" && status != "revoked" {
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
	return s.repo.ListInvitations(ctx, userID, status, limit, before, id)
}
func (s *Service) Respond(ctx context.Context, userID, invitationID, status string) (*models.Team, error) {
	status = strings.TrimSpace(status)
	if !uuidPattern.MatchString(invitationID) || (status != "accepted" && status != "declined") {
		return nil, ErrInvalidInput
	}
	item, err := s.repo.Respond(ctx, userID, invitationID, status)
	return item, mapError(err)
}
func mapError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if errors.Is(err, team_repo.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(err, team_repo.ErrInvalidTransition) {
		return ErrInvalidTransition
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}
