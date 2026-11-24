package community_handler

import (
	"encoding/json"
	"errors"
	"io"
	"it-project-showcase/backend/internal/middleware"
	community_service "it-project-showcase/backend/internal/services/community"
	"it-project-showcase/backend/pkg"
	"net/http"
	"strconv"
)

type Handler struct{ service *community_service.Service }

func Init(s *community_service.Service) *Handler { return &Handler{s} }

type commentRequest struct {
	Body string `json:"body"`
}
type reportRequest struct {
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Reason       string `json:"reason"`
	Details      string `json:"details"`
}
type reportUpdate struct {
	Status     string `json:"status"`
	Resolution string `json:"resolution"`
}

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
func page(r *http.Request) (int, int, bool) {
	return pageDefault(r, 20)
}
func pageDefault(r *http.Request, defaultSize int) (int, int, bool) {
	p, e := strconv.Atoi(defaultValue(r.URL.Query().Get("page"), "1"))
	if e != nil || p < 1 {
		return 0, 0, false
	}
	s, e := strconv.Atoi(defaultValue(r.URL.Query().Get("page_size"), strconv.Itoa(defaultSize)))
	if e != nil || s < 1 || s > 100 {
		return 0, 0, false
	}
	return s, (p - 1) * s, true
}
func defaultValue(x, d string) string {
	if x == "" {
		return d
	}
	return x
}
func (h *Handler) ListCaseComments(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, "case", r.PathValue("case_id"), "")
}
func (h *Handler) CreateCaseComment(w http.ResponseWriter, r *http.Request) {
	h.create(w, r, "case", r.PathValue("case_id"), "")
}
func (h *Handler) ListProjectComments(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, "student_project", r.PathValue("project_id"), "")
}
func (h *Handler) CreateProjectComment(w http.ResponseWriter, r *http.Request) {
	h.create(w, r, "student_project", r.PathValue("project_id"), "")
}
func (h *Handler) ListReplies(w http.ResponseWriter, r *http.Request) {
	limit, offset, ok := pageDefault(r, 10)
	if !ok {
		pkg.WriteError(w, 400, "invalid_query", "Invalid pagination")
		return
	}
	viewer, _ := middleware.UserIDFromContext(r.Context())
	items, total, e := h.service.ListReplies(r.Context(), viewer, r.PathValue("comment_id"), limit, offset)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": items, "meta": map[string]any{"total": total, "page": offset/limit + 1, "page_size": limit}})
}
func (h *Handler) CreateReply(w http.ResponseWriter, r *http.Request) {
	var req commentRequest
	if !decode(w, r, &req) {
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.CreateReply(r.Context(), u, r.PathValue("comment_id"), req.Body)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) list(w http.ResponseWriter, r *http.Request, k, id, parent string) {
	limit, offset, ok := page(r)
	if !ok {
		pkg.WriteError(w, 400, "invalid_query", "Invalid pagination")
		return
	}
	sort := defaultValue(r.URL.Query().Get("sort"), "newest")
	viewer, _ := middleware.UserIDFromContext(r.Context())
	items, total, e := h.service.ListComments(r.Context(), viewer, k, id, parent, sort, limit, offset)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": items, "meta": map[string]any{"total": total, "page": offset/limit + 1, "page_size": limit}})
}
func (h *Handler) create(w http.ResponseWriter, r *http.Request, k, id, parent string) {
	var req commentRequest
	if !decode(w, r, &req) {
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.CreateComment(r.Context(), u, k, id, parent, req.Body)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserIDFromContext(r.Context())
	e := h.service.DeleteComment(r.Context(), u, r.PathValue("comment_id"), hasRole(r, "admin"))
	if e != nil {
		writeError(w, e)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) SetCommentLike(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserIDFromContext(r.Context())
	state, err := h.service.SetCommentLike(r.Context(), user, r.PathValue("comment_id"), r.Method == http.MethodPut)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, state)
}

func (h *Handler) CreateReport(w http.ResponseWriter, r *http.Request) {
	var req reportRequest
	if !decode(w, r, &req) {
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.CreateReport(r.Context(), u, req.ResourceType, req.ResourceID, req.Reason, req.Details)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) ListReports(w http.ResponseWriter, r *http.Request) {
	limit, offset, ok := page(r)
	if !ok {
		pkg.WriteError(w, 400, "invalid_query", "Invalid pagination")
		return
	}
	x, total, e := h.service.ListReports(r.Context(), r.URL.Query().Get("status"), limit, offset)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x, "meta": map[string]any{"total": total, "page": offset/limit + 1, "page_size": limit}})
}
func (h *Handler) UpdateReport(w http.ResponseWriter, r *http.Request) {
	var req reportUpdate
	if !decode(w, r, &req) {
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.UpdateReport(r.Context(), u, r.PathValue("report_id"), req.Status, req.Resolution)
	if e != nil {
		writeError(w, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func hasRole(r *http.Request, want string) bool {
	c, ok := middleware.TokenClaimsFromContext(r.Context())
	if !ok || c == nil {
		return false
	}
	for _, x := range c.Roles {
		if x == want {
			return true
		}
	}
	return false
}
func writeError(w http.ResponseWriter, e error) {
	if errors.Is(e, community_service.ErrInvalid) {
		pkg.WriteError(w, 422, "validation_failed", "Community data is invalid")
	} else if errors.Is(e, community_service.ErrNotFound) {
		pkg.WriteError(w, 404, "resource_not_found", "Resource not found")
	} else if errors.Is(e, community_service.ErrConflict) {
		pkg.WriteError(w, 409, "report_conflict", "An open report already exists")
	} else {
		pkg.WriteError(w, 500, "community_request_failed", "Community request failed")
	}
}
