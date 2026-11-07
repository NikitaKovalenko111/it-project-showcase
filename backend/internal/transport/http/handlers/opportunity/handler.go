package opportunity_handler

import (
	"encoding/json"
	"errors"
	"io"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	opportunities_service "it-project-showcase/backend/internal/services/opportunities"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"net/http"
	"strconv"
)

type Handler struct {
	service *opportunities_service.Service
}

func Init(s *opportunities_service.Service) *Handler { return &Handler{s} }
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	d := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return false
	}
	var x any
	if e := d.Decode(&x); !errors.Is(e, io.EOF) {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return false
	}
	return true
}
func paging(r *http.Request) (int, int, bool) {
	p, e := strconv.Atoi(or(r.URL.Query().Get("page"), "1"))
	if e != nil || p < 1 {
		return 0, 0, false
	}
	s, e := strconv.Atoi(or(r.URL.Query().Get("page_size"), "20"))
	if e != nil || s < 1 || s > 100 {
		return 0, 0, false
	}
	return s, (p - 1) * s, true
}
func or(x, d string) string {
	if x == "" {
		return d
	}
	return x
}
func user(r *http.Request) string { u, _ := middleware.UserIDFromContext(r.Context()); return u }
func admin(r *http.Request) bool {
	c, ok := middleware.TokenClaimsFromContext(r.Context())
	if !ok || c == nil {
		return false
	}
	for _, x := range c.Roles {
		if x == "admin" {
			return true
		}
	}
	return false
}

type teamUpdate struct {
	Name              string `json:"name"`
	Description       string `json:"description"`
	Visibility        string `json:"visibility"`
	LookingForMembers bool   `json:"looking_for_members"`
}
type joinRequest struct {
	RoleID       string `json:"role_id"`
	ResumeFileID string `json:"resume_file_id"`
	CoverLetter  string `json:"cover_letter"`
}
type statusRequest struct {
	Status  string `json:"status"`
	Comment string `json:"comment"`
}
type teamProfileRequest struct {
	Headline     string `json:"headline"`
	Description  string `json:"description"`
	ResumeFileID string `json:"resume_file_id"`
	IsVisible    bool   `json:"is_visible"`
}
type placementsRequest struct {
	Placements []models.PlacementInput `json:"placements"`
}
type curatorRequest struct {
	CuratorID string `json:"curator_id"`
}
type portfolioFileRequest struct {
	FileID     string `json:"file_id"`
	Kind       string `json:"kind"`
	IsDefault  bool   `json:"is_default"`
	Visibility string `json:"visibility"`
}
type ndaRequest struct {
	Text   string `json:"text"`
	FileID string `json:"file_id"`
}
type ndaAccept struct {
	NDAVersionID string `json:"nda_version_id"`
	Accepted     bool   `json:"accepted"`
}
type coverRequest struct {
	FileID string `json:"file_id"`
}

func (h *Handler) ListTeams(w http.ResponseWriter, r *http.Request) {
	l, o, ok := paging(r)
	if !ok {
		badQuery(w)
		return
	}
	x, t, e := h.service.ListOpenTeams(r.Context(), l, o)
	if e != nil {
		writeError(w, e)
		return
	}
	page(w, x, t, l, o)
}
func (h *Handler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	var q teamUpdate
	if !decode(w, r, &q) {
		return
	}
	if e := h.service.UpdateTeam(r.Context(), user(r), r.PathValue("team_id"), q.Name, q.Description, q.Visibility, q.LookingForMembers); e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) ApplyTeam(w http.ResponseWriter, r *http.Request) {
	var q joinRequest
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.ApplyTeam(r.Context(), user(r), r.PathValue("team_id"), q.RoleID, q.ResumeFileID, q.CoverLetter)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) ListMyTeamApplications(w http.ResponseWriter, r *http.Request) {
	query, err := pagination.ParsePageQuery(r.URL.Query())
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	items, total, err := h.service.ListMyTeamApplications(r.Context(), user(r), query.PageSize, query.Offset)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, pagination.NewPageResponse(items, query, int64(total)))
}

func (h *Handler) ListTeamApplications(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.ListTeamApplications(r.Context(), user(r), r.PathValue("team_id"))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) RespondTeamApplication(w http.ResponseWriter, r *http.Request) {
	var q statusRequest
	if !decode(w, r, &q) {
		return
	}
	if e := h.service.RespondTeamApplication(r.Context(), user(r), r.PathValue("application_id"), q.Status); e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) UpsertTeamProfile(w http.ResponseWriter, r *http.Request) {
	var q teamProfileRequest
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.UpsertTeamProfile(r.Context(), user(r), q.Headline, q.Description, q.ResumeFileID, q.IsVisible)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) ListTeamProfiles(w http.ResponseWriter, r *http.Request) {
	l, o, ok := paging(r)
	if !ok {
		badQuery(w)
		return
	}
	x, t, e := h.service.ListTeamProfiles(r.Context(), l, o)
	if e != nil {
		writeError(w, e)
		return
	}
	page(w, x, t, l, o)
}
func (h *Handler) ListInternships(w http.ResponseWriter, r *http.Request) {
	h.listInternships(w, r, "published")
}

func (h *Handler) ListInternshipModeration(w http.ResponseWriter, r *http.Request) {
	h.listInternships(w, r, "moderation")
}

func (h *Handler) listInternships(w http.ResponseWriter, r *http.Request, status string) {
	l, o, ok := paging(r)
	if !ok {
		badQuery(w)
		return
	}
	x, t, e := h.service.ListInternships(r.Context(), status, l, o)
	if e != nil {
		writeError(w, e)
		return
	}
	page(w, x, t, l, o)
}
func (h *Handler) GetInternship(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.GetInternship(r.Context(), r.PathValue("program_id"), user(r), admin(r))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) CreateInternship(w http.ResponseWriter, r *http.Request) {
	var q models.InternshipInput
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.CreateInternship(r.Context(), user(r), q)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) UpdateInternship(w http.ResponseWriter, r *http.Request) {
	var input models.InternshipInput
	if !decode(w, r, &input) {
		return
	}
	item, err := h.service.UpdateInternship(r.Context(), user(r), r.PathValue("program_id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}

func (h *Handler) UpdateInternshipStatus(w http.ResponseWriter, r *http.Request) {
	var q statusRequest
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.UpdateInternshipStatus(r.Context(), user(r), r.PathValue("program_id"), q.Status, q.Comment, admin(r))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.Leaderboard(r.Context(), r.PathValue("case_id"))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) SetPlacements(w http.ResponseWriter, r *http.Request) {
	var q placementsRequest
	if !decode(w, r, &q) {
		return
	}
	if e := h.service.SetPlacements(r.Context(), user(r), r.PathValue("case_id"), q.Placements); e != nil {
		writeError(w, e)
		return
	}
	h.Leaderboard(w, r)
}
func (h *Handler) GetCurator(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.GetCurator(r.Context(), r.PathValue("student_id"))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) SetCurator(w http.ResponseWriter, r *http.Request) {
	var q curatorRequest
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.SetCurator(r.Context(), user(r), r.PathValue("student_id"), q.CuratorID)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) AssignSelfCurator(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.AssignSelfCurator(r.Context(), user(r), r.PathValue("student_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}

func (h *Handler) RevokeCurator(w http.ResponseWriter, r *http.Request) {
	if e := h.service.RevokeCurator(r.Context(), r.PathValue("student_id")); e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) AttachPortfolioFile(w http.ResponseWriter, r *http.Request) {
	var q portfolioFileRequest
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.AttachPortfolioFile(r.Context(), user(r), q.FileID, q.Kind, q.Visibility, q.IsDefault)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) ListMyPortfolioFiles(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.ListPortfolioFiles(r.Context(), user(r), false)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) DetachPortfolioFile(w http.ResponseWriter, r *http.Request) {
	if e := h.service.DetachPortfolioFile(r.Context(), user(r), r.PathValue("file_id")); e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) ListPublicPortfolioFiles(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.ListPortfolioFiles(r.Context(), r.PathValue("student_id"), true)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) ApplicationDefaults(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.ApplicationDefaults(r.Context(), user(r))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Rating(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.Rating(r.Context(), r.PathValue("student_id"))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) CreateNDA(w http.ResponseWriter, r *http.Request) {
	var q ndaRequest
	if !decode(w, r, &q) {
		return
	}
	x, e := h.service.CreateNDA(r.Context(), user(r), r.PathValue("case_id"), q.Text, q.FileID)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) GetNDA(w http.ResponseWriter, r *http.Request) {
	x, e := h.service.GetNDA(r.Context(), r.PathValue("case_id"))
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) AcceptNDA(w http.ResponseWriter, r *http.Request) {
	var q ndaAccept
	if !decode(w, r, &q) {
		return
	}
	if e := h.service.AcceptNDA(r.Context(), user(r), r.PathValue("case_id"), q.NDAVersionID, q.Accepted); e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) SetCaseCover(w http.ResponseWriter, r *http.Request) {
	var q coverRequest
	if !decode(w, r, &q) {
		return
	}
	if e := h.service.SetCaseCover(r.Context(), user(r), r.PathValue("case_id"), q.FileID); e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func page(w http.ResponseWriter, x any, total, limit, offset int) {
	pkg.WriteJSON(w, 200, map[string]any{"items": x, "meta": map[string]any{"total": total, "page": offset/limit + 1, "page_size": limit}})
}
func badQuery(w http.ResponseWriter) { pkg.WriteError(w, 400, "invalid_query", "Invalid pagination") }
func writeError(w http.ResponseWriter, e error) {
	switch {
	case errors.Is(e, opportunities_service.ErrInvalid):
		pkg.WriteError(w, 422, "validation_failed", "Request data is invalid")
	case errors.Is(e, opportunities_service.ErrForbidden):
		pkg.WriteError(w, 403, "permission_denied", "Permission denied")
	case errors.Is(e, opportunities_service.ErrNotFound):
		pkg.WriteError(w, 404, "resource_not_found", "Resource not found")
	case errors.Is(e, opportunities_service.ErrCuratorAssigned):
		pkg.WriteError(w, 409, "student_curator_already_assigned", "Student already has an active curator")
	case errors.Is(e, opportunities_service.ErrConflict):
		pkg.WriteError(w, 409, "resource_conflict", "Resource conflict")
	default:
		pkg.WriteError(w, 500, "opportunity_request_failed", "Opportunity request failed")
	}
}
