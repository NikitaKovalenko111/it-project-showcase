package studentprojects_service

import (
	"context"
	"database/sql"
	"errors"
	"github.com/google/uuid"
	"it-project-showcase/backend/internal/models"
	studentproject_repo "it-project-showcase/backend/internal/storage/repositories/studentproject"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalid    = errors.New("invalid student project")
	ErrForbidden  = errors.New("student project access denied")
	ErrNotFound   = errors.New("student project not found")
	ErrTransition = errors.New("invalid student project transition")
	ErrCursor     = errors.New("invalid cursor")
)

type Service struct {
	repo *studentproject_repo.Repository
}

func Init(r *studentproject_repo.Repository) *Service { return &Service{r} }
func validID(x string) bool                           { _, e := uuid.Parse(x); return e == nil }
func validate(in models.StudentProjectInput) error {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" || in.ShortDescription == "" || in.FullDescription == "" || utf8.RuneCountInString(in.Title) > 200 || utf8.RuneCountInString(in.ShortDescription) > 1000 || utf8.RuneCountInString(in.FullDescription) > 30000 || len(in.DirectionIDs) > 20 || len(in.TechnologyIDs) > 50 || len(in.Members) > 30 || len(in.Assets) > 50 {
		return ErrInvalid
	}
	switch in.Category {
	case "coursework", "pet_project", "startup", "research", "hackathon", "other":
	default:
		return ErrInvalid
	}
	if in.Visibility == "" {
		in.Visibility = "public"
	}
	if in.Visibility != "public" && in.Visibility != "private" || len(in.Tags) > 10 {
		return ErrInvalid
	}
	tagSeen := map[string]bool{}
	for _, tag := range in.Tags {
		tag = strings.TrimSpace(tag)
		key := strings.ToLower(tag)
		if tag == "" || utf8.RuneCountInString(tag) > 40 || tagSeen[key] {
			return ErrInvalid
		}
		tagSeen[key] = true
	}
	if in.CoverFileID != "" && !validID(in.CoverFileID) {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, x := range append(in.DirectionIDs, in.TechnologyIDs...) {
		if !validID(x) {
			return ErrInvalid
		}
		if seen[x] {
			return ErrInvalid
		}
		seen[x] = true
	}
	seen = map[string]bool{}
	for _, x := range in.Members {
		if !validID(x.StudentID) || strings.TrimSpace(x.RoleName) == "" || seen[x.StudentID] {
			return ErrInvalid
		}
		seen[x.StudentID] = true
	}
	seen = map[string]bool{}
	for _, x := range in.Assets {
		if !validID(x.FileID) || x.Ordinal < 1 || seen[x.FileID] || (x.Kind != "asset" && x.Kind != "screenshot" && x.Kind != "presentation" && x.Kind != "video" && x.Kind != "documentation") {
			return ErrInvalid
		}
		seen[x.FileID] = true
	}
	return nil
}
func (s *Service) List(ctx context.Context, u, search, cat, dir string, limit int, pos, id string) ([]models.StudentProject, error) {
	var before *time.Time
	if pos != "" {
		x, e := time.Parse(time.RFC3339Nano, pos)
		if e != nil || !validID(id) {
			return nil, ErrCursor
		}
		before = &x
	}
	return s.repo.List(ctx, u, strings.TrimSpace(search), cat, dir, limit, before, id)
}
func (s *Service) Get(ctx context.Context, u, id string, a bool) (*models.StudentProject, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	x, e := s.repo.Get(ctx, u, id, a)
	return x, mapErr(e, true)
}
func (s *Service) Create(ctx context.Context, u string, in models.StudentProjectInput) (*models.StudentProject, error) {
	if e := validate(in); e != nil {
		return nil, e
	}
	x, e := s.repo.Create(ctx, u, in)
	return x, mapErr(e, false)
}
func (s *Service) Update(ctx context.Context, u, id string, in models.StudentProjectInput) (*models.StudentProject, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	if e := validate(in); e != nil {
		return nil, e
	}
	x, e := s.repo.Update(ctx, u, id, in)
	return x, mapErr(e, false)
}
func (s *Service) Submit(ctx context.Context, u, id string) (*models.StudentProject, error) {
	if !validID(id) {
		return nil, ErrNotFound
	}
	x, e := s.repo.Submit(ctx, u, id)
	return x, mapErr(e, false)
}
func (s *Service) Moderate(ctx context.Context, u, id, status, comment string) (*models.StudentProject, error) {
	if !validID(id) || (status != "published" && status != "revision" && status != "hidden") {
		return nil, ErrInvalid
	}
	x, e := s.repo.Moderate(ctx, u, id, status, strings.TrimSpace(comment))
	return x, mapErr(e, false)
}
func (s *Service) Like(ctx context.Context, u, id string, like bool) (int, error) {
	if !validID(id) {
		return 0, ErrNotFound
	}
	n, e := s.repo.Like(ctx, u, id, like)
	return n, mapErr(e, false)
}
func mapErr(e error, _ bool) error {
	if e == nil {
		return nil
	}
	if errors.Is(e, studentproject_repo.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(e, studentproject_repo.ErrTransition) {
		return ErrTransition
	}
	if errors.Is(e, sql.ErrNoRows) {
		return ErrNotFound
	}
	return e
}
