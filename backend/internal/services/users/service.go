package users_service

import (
	"context"
	"database/sql"
	"errors"

	"it-project-showcase/backend/internal/models"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
)

var (
	ErrNotFound      = errors.New("user not found")
	ErrInvalidStatus = errors.New("invalid user status")
)

type Service struct{ userRepo *users_repo.UsersRepo }

func Init(userRepo *users_repo.UsersRepo) *Service { return &Service{userRepo: userRepo} }

func (s *Service) SetStatus(ctx context.Context, userID, status string) error {
	if status != "active" && status != "blocked" && status != "deleted" {
		return ErrInvalidStatus
	}
	if err := s.userRepo.SetUserStatus(ctx, userID, status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *Service) List(ctx context.Context, limit, offset int) ([]models.User, error) {
	return s.userRepo.List(ctx, limit, offset)
}
