package opportunities_service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"it-project-showcase/backend/internal/models"
	opportunity_repo "it-project-showcase/backend/internal/storage/repositories/opportunity"
)

var ErrInternshipFull = errors.New("internship capacity reached")

func (s *Service) ApplyInternship(ctx context.Context, user, program, letter, resume string) (*models.InternshipApplication, error) {
	letter = strings.TrimSpace(letter)
	if !id(program) || (resume != "" && !id(resume)) || utf8.RuneCountInString(letter) > 4000 {
		return nil, ErrInvalid
	}
	item, err := s.repo.ApplyInternship(ctx, user, program, letter, resume)
	return item, mapped(err)
}

func (s *Service) ListInternshipApplications(ctx context.Context, user, program string, mine bool, limit int, offset int64) ([]models.InternshipApplication, int64, error) {
	if !mine && !id(program) {
		return nil, 0, ErrNotFound
	}
	return s.repo.ListInternshipApplications(ctx, user, program, mine, limit, offset)
}

func (s *Service) DecideInternshipApplication(ctx context.Context, user, application, status string) (*models.InternshipApplication, error) {
	if !id(application) || (status != "accepted" && status != "rejected" && status != "withdrawn") {
		return nil, ErrInvalid
	}
	item, err := s.repo.DecideInternshipApplication(ctx, user, application, status)
	if errors.Is(err, opportunity_repo.ErrInternshipFull) {
		return nil, ErrInternshipFull
	}
	return item, mapped(err)
}
