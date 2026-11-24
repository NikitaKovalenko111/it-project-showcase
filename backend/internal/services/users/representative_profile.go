package users_service

import (
	"context"
	"database/sql"
	"errors"
	"it-project-showcase/backend/internal/models"
	"strings"
	"unicode/utf8"
)

var ErrInvalidRepresentativeProfile = errors.New("invalid representative profile")

func (s *Service) GetRepresentativeProfile(ctx context.Context, userID string) (*models.RepresentativeProfile, error) {
	p, err := s.userRepo.GetRepresentativeProfile(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return p, err
}
func (s *Service) UpdateRepresentativeProfile(ctx context.Context, userID string, input models.RepresentativeProfilePatch) (*models.RepresentativeProfile, error) {
	if input.ExperienceAndInterests == nil && input.HelpTopics == nil {
		return nil, ErrInvalidRepresentativeProfile
	}
	for _, field := range []struct {
		value **string
		limit int
	}{{&input.ExperienceAndInterests, 4000}, {&input.HelpTopics, 2000}} {
		if *field.value != nil {
			value := strings.TrimSpace(**field.value)
			if utf8.RuneCountInString(value) > field.limit {
				return nil, ErrInvalidRepresentativeProfile
			}
			*field.value = &value
		}
	}
	p, err := s.userRepo.UpdateRepresentativeProfile(ctx, userID, input)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return p, err
}
