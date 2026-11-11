package files_service

import (
	"context"
	"github.com/google/uuid"
	"io"
	"it-project-showcase/backend/internal/models"
)

func (s *Service) DownloadEventTaskFile(ctx context.Context, user, caseID, roundID, taskID, fileID string, admin bool) (*models.File, io.ReadCloser, error) {
	for _, id := range []string{caseID, roundID, taskID, fileID} {
		if _, err := uuid.Parse(id); err != nil {
			return nil, nil, ErrNotFound
		}
	}
	file, err := s.repo.GetEventTaskFile(ctx, user, caseID, roundID, taskID, fileID, admin)
	return s.open(ctx, file, err)
}

func (s *Service) DownloadEventSolutionFile(ctx context.Context, user, execution, roundID, fileID string, admin bool) (*models.File, io.ReadCloser, error) {
	for _, id := range []string{execution, roundID, fileID} {
		if _, err := uuid.Parse(id); err != nil {
			return nil, nil, ErrNotFound
		}
	}
	file, err := s.repo.GetEventSolutionFile(ctx, user, execution, roundID, fileID, admin)
	return s.open(ctx, file, err)
}
