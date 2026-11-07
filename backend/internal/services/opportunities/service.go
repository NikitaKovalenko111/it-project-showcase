package opportunities_service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"it-project-showcase/backend/internal/models"
	opportunity_repo "it-project-showcase/backend/internal/storage/repositories/opportunity"
	"strings"
)

var (
	ErrInvalid         = errors.New("invalid opportunity request")
	ErrForbidden       = errors.New("opportunity access denied")
	ErrNotFound        = errors.New("opportunity not found")
	ErrConflict        = errors.New("opportunity conflict")
	ErrCuratorAssigned = errors.New("student already has an active curator")
)

type Service struct{ repo *opportunity_repo.Repository }

func Init(r *opportunity_repo.Repository) *Service { return &Service{r} }
func id(x string) bool                             { _, e := uuid.Parse(x); return e == nil }
func mapped(e error) error {
	switch {
	case errors.Is(e, opportunity_repo.ErrForbidden):
		return ErrForbidden
	case errors.Is(e, opportunity_repo.ErrNotFound):
		return ErrNotFound
	case errors.Is(e, opportunity_repo.ErrConflict):
		return ErrConflict
	case errors.Is(e, opportunity_repo.ErrCuratorAssigned):
		return ErrCuratorAssigned
	}
	return e
}
func (s *Service) ListOpenTeams(ctx context.Context, l, o int) ([]models.Team, int, error) {
	return s.repo.ListOpenTeams(ctx, l, o)
}
func (s *Service) UpdateTeam(ctx context.Context, u, team, name, desc, visibility string, looking bool) error {
	name = strings.TrimSpace(name)
	desc = strings.TrimSpace(desc)
	if !id(team) || name == "" || len(name) > 200 || len(desc) > 4000 || (visibility != "private" && visibility != "open") {
		return ErrInvalid
	}
	return mapped(s.repo.UpdateTeamDiscovery(ctx, u, team, name, desc, visibility, looking))
}
func (s *Service) ApplyTeam(ctx context.Context, u, team, role, resume, letter string) (*models.TeamJoinApplication, error) {
	if !id(team) || (role != "" && !id(role)) || (resume != "" && !id(resume)) || len(letter) > 4000 {
		return nil, ErrInvalid
	}
	x, e := s.repo.ApplyTeam(ctx, u, team, role, resume, strings.TrimSpace(letter))
	return x, mapped(e)
}
func (s *Service) ListMyTeamApplications(ctx context.Context, user string, limit int, offset int64) ([]models.TeamJoinApplication, int, error) {
	return s.repo.ListMyTeamApplications(ctx, user, limit, offset)
}

func (s *Service) ListTeamApplications(ctx context.Context, u, team string) ([]models.TeamJoinApplication, error) {
	if !id(team) {
		return nil, ErrInvalid
	}
	return s.repo.ListTeamApplications(ctx, u, team)
}
func (s *Service) RespondTeamApplication(ctx context.Context, u, application, status string) error {
	if !id(application) || (status != "accepted" && status != "rejected") {
		return ErrInvalid
	}
	return mapped(s.repo.RespondTeamApplication(ctx, u, application, status))
}
func (s *Service) UpsertTeamProfile(ctx context.Context, u, headline, desc, resume string, visible bool) (*models.TeamSearchProfile, error) {
	headline = strings.TrimSpace(headline)
	desc = strings.TrimSpace(desc)
	if len(headline) > 200 || len(desc) > 4000 || (resume != "" && !id(resume)) {
		return nil, ErrInvalid
	}
	x, e := s.repo.UpsertTeamProfile(ctx, u, headline, desc, resume, visible)
	return x, mapped(e)
}
func (s *Service) ListTeamProfiles(ctx context.Context, l, o int) ([]models.TeamSearchProfile, int, error) {
	return s.repo.ListTeamProfiles(ctx, l, o)
}
func validateInternship(in *models.InternshipInput) error {
	in.Title = strings.TrimSpace(in.Title)
	in.Summary = strings.TrimSpace(in.Summary)
	in.ContentMarkdown = strings.TrimSpace(in.ContentMarkdown)
	if !id(in.CompanyID) || in.Title == "" || len(in.Title) > 200 || in.Summary == "" || len(in.Summary) > 1000 || in.ContentMarkdown == "" || len(in.ContentMarkdown) > 50000 {
		return ErrInvalid
	}
	return nil
}

func (s *Service) CreateInternship(ctx context.Context, u string, in models.InternshipInput) (*models.InternshipProgram, error) {
	if err := validateInternship(&in); err != nil {
		return nil, err
	}
	x, e := s.repo.CreateInternship(ctx, u, in)
	return x, mapped(e)
}

func (s *Service) UpdateInternship(ctx context.Context, user, programID string, in models.InternshipInput) (*models.InternshipProgram, error) {
	if !id(programID) {
		return nil, ErrNotFound
	}
	if err := validateInternship(&in); err != nil {
		return nil, err
	}
	item, err := s.repo.UpdateInternship(ctx, user, programID, in)
	return item, mapped(err)
}
func (s *Service) GetInternship(ctx context.Context, idv, user string, admin bool) (*models.InternshipProgram, error) {
	if !id(idv) {
		return nil, ErrNotFound
	}
	x, e := s.repo.GetInternship(ctx, idv, admin, user)
	return x, mapped(e)
}
func (s *Service) ListInternships(ctx context.Context, status string, l, o int) ([]models.InternshipProgram, int, error) {
	return s.repo.ListInternships(ctx, status, l, o)
}
func (s *Service) UpdateInternshipStatus(ctx context.Context, u, idv, status, comment string, admin bool) (*models.InternshipProgram, error) {
	allowed := map[string]bool{"moderation": true, "published": true, "revision": true, "closed": true, "hidden": true}
	if !id(idv) || !allowed[status] || len(comment) > 4000 {
		return nil, ErrInvalid
	}
	if !admin && (status != "moderation" && status != "closed") {
		return nil, ErrForbidden
	}
	x, e := s.repo.UpdateInternshipStatus(ctx, u, idv, status, strings.TrimSpace(comment), admin)
	return x, mapped(e)
}
func (s *Service) Leaderboard(ctx context.Context, c string) ([]models.LeaderboardEntry, error) {
	if !id(c) {
		return nil, ErrNotFound
	}
	return s.repo.Leaderboard(ctx, c)
}
func (s *Service) SetPlacements(ctx context.Context, u, c string, items []models.PlacementInput) error {
	if !id(c) || len(items) == 0 || len(items) > 100 {
		return ErrInvalid
	}
	seen := map[int]bool{}
	for _, x := range items {
		if !id(x.ExecutionID) || (x.PlaceNo == nil && strings.TrimSpace(x.Nomination) == "") {
			return ErrInvalid
		}
		if x.PlaceNo != nil {
			if *x.PlaceNo < 1 || seen[*x.PlaceNo] {
				return ErrInvalid
			}
			seen[*x.PlaceNo] = true
		}
	}
	return mapped(s.repo.SetPlacements(ctx, u, c, items))
}
func (s *Service) SetCurator(ctx context.Context, a, student, curator string) (*models.CuratorAssignment, error) {
	if !id(student) || !id(curator) {
		return nil, ErrInvalid
	}
	x, e := s.repo.SetCurator(ctx, a, student, curator)
	return x, mapped(e)
}
func (s *Service) AssignSelfCurator(ctx context.Context, curator, student string) (*models.CuratorAssignment, error) {
	if !id(student) {
		return nil, ErrNotFound
	}
	item, err := s.repo.AssignSelfCurator(ctx, curator, student)
	return item, mapped(err)
}

func (s *Service) GetCurator(ctx context.Context, student string) (*models.CuratorAssignment, error) {
	if !id(student) {
		return nil, ErrNotFound
	}
	x, e := s.repo.GetCurator(ctx, student)
	return x, mapped(e)
}
func (s *Service) RevokeCurator(ctx context.Context, student string) error {
	if !id(student) {
		return ErrNotFound
	}
	return mapped(s.repo.RevokeCurator(ctx, student))
}
func (s *Service) AttachPortfolioFile(ctx context.Context, u, file, kind, visibility string, def bool) (*models.PortfolioFile, error) {
	if !id(file) || (kind != "resume" && kind != "portfolio" && kind != "certificate" && kind != "other") || (visibility != "public" && visibility != "private") {
		return nil, ErrInvalid
	}
	x, e := s.repo.AttachPortfolioFile(ctx, u, file, kind, visibility, def)
	return x, mapped(e)
}
func (s *Service) ListPortfolioFiles(ctx context.Context, student string, public bool) ([]models.PortfolioFile, error) {
	if !id(student) {
		return nil, ErrNotFound
	}
	return s.repo.ListPortfolioFiles(ctx, student, public)
}
func (s *Service) DetachPortfolioFile(ctx context.Context, u, file string) error {
	if !id(file) {
		return ErrNotFound
	}
	return mapped(s.repo.DetachPortfolioFile(ctx, u, file))
}
func (s *Service) ApplicationDefaults(ctx context.Context, u string) (*models.ApplicationDefaults, error) {
	return s.repo.ApplicationDefaults(ctx, u)
}
func (s *Service) Rating(ctx context.Context, student string) (*models.StudentRating, error) {
	if !id(student) {
		return nil, ErrNotFound
	}
	return s.repo.Rating(ctx, student)
}
func (s *Service) CreateNDA(ctx context.Context, u, c, text, file string) (*models.NDAVersion, error) {
	text = strings.TrimSpace(text)
	if !id(c) || text == "" || len(text) > 50000 || (file != "" && !id(file)) {
		return nil, ErrInvalid
	}
	x, e := s.repo.CreateNDAVersion(ctx, u, c, text, file)
	return x, mapped(e)
}
func (s *Service) GetNDA(ctx context.Context, c string) (*models.NDAVersion, error) {
	if !id(c) {
		return nil, ErrNotFound
	}
	x, e := s.repo.GetCurrentNDA(ctx, c)
	return x, mapped(e)
}
func (s *Service) AcceptNDA(ctx context.Context, u, c, version string, accepted bool) error {
	if !accepted || !id(c) || !id(version) {
		return ErrInvalid
	}
	return mapped(s.repo.AcceptNDA(ctx, u, c, version))
}
func (s *Service) SetCaseCover(ctx context.Context, u, c, file string) error {
	if !id(c) || !id(file) {
		return ErrInvalid
	}
	return mapped(s.repo.SetCaseCover(ctx, u, c, file))
}
