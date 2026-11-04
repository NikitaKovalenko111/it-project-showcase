package community_service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"it-project-showcase/backend/internal/models"
	community_repo "it-project-showcase/backend/internal/storage/repositories/community"
	"strings"
)

var (
	ErrInvalid  = errors.New("invalid community request")
	ErrNotFound = errors.New("community resource not found")
	ErrConflict = errors.New("community resource conflict")
)

type Service struct{ repo *community_repo.Repository }

func Init(r *community_repo.Repository) *Service { return &Service{r} }
func validID(x string) bool                      { _, e := uuid.Parse(x); return e == nil }
func (s *Service) CreateComment(ctx context.Context, u, k, id, parent, body string) (*models.Comment, error) {
	body = strings.TrimSpace(body)
	if !validID(id) || (k != "case" && k != "student_project") || body == "" || len(body) > 4000 {
		return nil, ErrInvalid
	}
	var p *string
	if parent != "" {
		if !validID(parent) {
			return nil, ErrInvalid
		}
		p = &parent
	}
	return s.repo.CreateComment(ctx, u, k, id, p, body)
}
func (s *Service) ListComments(ctx context.Context, k, id, parent, sort string, limit, offset int) ([]models.Comment, int, error) {
	if !validID(id) || (k != "case" && k != "student_project") || (sort != "newest" && sort != "oldest" && sort != "popular") {
		return nil, 0, ErrInvalid
	}
	var p *string
	if parent != "" {
		if !validID(parent) {
			return nil, 0, ErrInvalid
		}
		p = &parent
	}
	return s.repo.ListComments(ctx, k, id, p, sort, limit, offset)
}
func (s *Service) ListReplies(ctx context.Context, parent string, limit, offset int) ([]models.Comment, int, error) {
	if !validID(parent) {
		return nil, 0, ErrNotFound
	}
	p, e := s.repo.GetComment(ctx, parent)
	if errors.Is(e, community_repo.ErrNotFound) {
		return nil, 0, ErrNotFound
	}
	if e != nil {
		return nil, 0, e
	}
	return s.repo.ListComments(ctx, p.ResourceType, p.ResourceID, &parent, "oldest", limit, offset)
}
func (s *Service) CreateReply(ctx context.Context, u, parent, body string) (*models.Comment, error) {
	if !validID(parent) {
		return nil, ErrNotFound
	}
	p, e := s.repo.GetComment(ctx, parent)
	if errors.Is(e, community_repo.ErrNotFound) {
		return nil, ErrNotFound
	}
	if e != nil {
		return nil, e
	}
	return s.CreateComment(ctx, u, p.ResourceType, p.ResourceID, parent, body)
}
func (s *Service) DeleteComment(ctx context.Context, u, id string, admin bool) error {
	if !validID(id) {
		return ErrNotFound
	}
	e := s.repo.DeleteComment(ctx, u, id, admin)
	if errors.Is(e, community_repo.ErrNotFound) {
		return ErrNotFound
	}
	return e
}
func (s *Service) CreateReport(ctx context.Context, u, k, id, reason, details string) (*models.Report, error) {
	allowedK := map[string]bool{"case": true, "student_project": true, "comment": true, "profile": true}
	allowedR := map[string]bool{"spam": true, "abuse": true, "fraud": true, "copyright": true, "personal_data": true, "other": true}
	details = strings.TrimSpace(details)
	if !allowedK[k] || !allowedR[reason] || !validID(id) || len(details) > 4000 {
		return nil, ErrInvalid
	}
	x, e := s.repo.CreateReport(ctx, u, k, id, reason, details)
	if errors.Is(e, community_repo.ErrConflict) {
		return nil, ErrConflict
	}
	return x, e
}
func (s *Service) ListReports(ctx context.Context, status string, limit, offset int) ([]models.Report, int, error) {
	if status != "" && status != "open" && status != "reviewing" && status != "resolved" && status != "rejected" {
		return nil, 0, ErrInvalid
	}
	return s.repo.ListReports(ctx, status, limit, offset)
}
func (s *Service) UpdateReport(ctx context.Context, u, id, status, resolution string) (*models.Report, error) {
	if !validID(id) || (status != "reviewing" && status != "resolved" && status != "rejected") || len(resolution) > 4000 {
		return nil, ErrInvalid
	}
	x, e := s.repo.UpdateReport(ctx, u, id, status, strings.TrimSpace(resolution))
	if errors.Is(e, community_repo.ErrNotFound) {
		return nil, ErrNotFound
	}
	return x, e
}
