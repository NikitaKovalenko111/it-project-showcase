package community_service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"it-project-showcase/backend/internal/models"
	community_repo "it-project-showcase/backend/internal/storage/repositories/community"
)

func (s *Service) CreateFeedback(ctx context.Context, author, body string, files []string) (*models.Feedback, error) {
	body = strings.TrimSpace(body)
	if body == "" || utf8.RuneCountInString(body) > 4000 || len(files) > 5 {
		return nil, ErrInvalid
	}
	seen := make(map[uuid.UUID]bool, len(files))
	for _, file := range files {
		id, err := uuid.Parse(file)
		if err != nil || seen[id] {
			return nil, ErrInvalid
		}
		seen[id] = true
	}
	item, err := s.repo.CreateFeedback(ctx, author, body, files)
	if errors.Is(err, community_repo.ErrFeedbackFile) {
		return nil, ErrInvalid
	}
	return item, err
}

func (s *Service) ListFeedback(ctx context.Context, user, status string, admin bool, limit int, offset int64) ([]models.Feedback, int64, error) {
	if status != "" && status != "reviewing" && status != "accepted" && status != "rejected" {
		return nil, 0, ErrInvalid
	}
	return s.repo.ListFeedback(ctx, user, status, admin, limit, offset)
}

func (s *Service) ReviewFeedback(ctx context.Context, actor, id, status string) error {
	if !validID(id) || (status != "accepted" && status != "rejected") {
		return ErrInvalid
	}
	err := s.repo.ReviewFeedback(ctx, actor, id, status)
	if errors.Is(err, community_repo.ErrNotFound) {
		return ErrNotFound
	}
	return err
}
