package users_service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"it-project-showcase/backend/internal/models"
	auth_service "it-project-showcase/backend/internal/services/auth"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
)

var (
	ErrNotFound      = errors.New("user not found")
	ErrInvalidReason = errors.New("invalid status reason")
	ErrInvalidStatus = errors.New("invalid user status")
	ErrEmailTaken    = errors.New("email already in use")
)

type Service struct{ userRepo *users_repo.UsersRepo }

func Init(userRepo *users_repo.UsersRepo) *Service { return &Service{userRepo: userRepo} }

func (s *Service) List(ctx context.Context, limit int, offset int64) ([]models.UserListItem, int64, error) {
	return s.userRepo.ListUsers(ctx, limit, offset)
}

func (s *Service) ReviewRole(ctx context.Context, actor, userID, status string) error {
	if _, err := uuid.Parse(userID); err != nil {
		return ErrNotFound
	}
	if status != "approved" && status != "rejected" {
		return ErrInvalidStatus
	}
	err := s.userRepo.ReviewRole(ctx, actor, userID, status)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Service) UpdateStudentProfile(ctx context.Context, userID string, input models.StudentProfileUpdate) error {
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	for _, value := range []*string{&input.FirstName, &input.LastName, &input.Patronymic, &input.Institute, &input.Direction, &input.Program, &input.EducationLevel, &input.GroupName, &input.Phone, &input.Bio} {
		*value = strings.TrimSpace(*value)
	}
	err := auth_service.ValidateStudentProfile(models.StudentRegistration{Email: input.Email, FirstName: input.FirstName, LastName: input.LastName,
		Patronymic: input.Patronymic, Institute: input.Institute, Direction: input.Direction, Program: input.Program, EducationLevel: input.EducationLevel,
		Course: input.Course, GroupName: input.GroupName, Phone: input.Phone, Bio: input.Bio, ProfessionalInterests: input.ProfessionalInterests,
		Competencies: input.Competencies, Technologies: input.Technologies, Links: input.Links})
	if err != nil {
		return err
	}
	err = s.userRepo.UpdateStudentProfile(ctx, userID, input)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.ConstraintName == "users_email_idx" {
		return ErrEmailTaken
	}
	return err
}

func (s *Service) SetStatus(ctx context.Context, userID, status, reason string) error {
	if status != "active" && status != "blocked" && status != "deleted" {
		return ErrInvalidStatus
	}
	reason = strings.TrimSpace(reason)
	if utf8.RuneCountInString(reason) > 1000 {
		return ErrInvalidReason
	}
	if _, err := uuid.Parse(userID); err != nil {
		return ErrNotFound
	}
	if err := s.userRepo.SetUserStatus(ctx, userID, status, reason); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}
