package studentproject_handler

import (
	"encoding/json"
	"errors"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	studentprojects_service "it-project-showcase/backend/internal/services/studentprojects"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"net/http"
	"time"
)

type Handler struct {
	s *studentprojects_service.Service
}

func Init(s *studentprojects_service.Service) *Handler { return &Handler{s} }
func user(r *http.Request) string                      { u, _ := middleware.UserIDFromContext(r.Context()); return u }
func admin(r *http.Request) bool {
	x, ok := middleware.TokenClaimsFromContext(r.Context())
	if ok {
		for _, v := range x.Roles {
			if v == "admin" {
				return true
			}
		}
	}
	return false
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return false
	}
	return true
}
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, "student-projects")
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, "student-projects-mine")
}

func (h *Handler) ListModeration(w http.ResponseWriter, r *http.Request) {
	if admin(r) {
		h.list(w, r, "student-projects-moderation")
		return
	}
	h.list(w, r, "student-projects-review")
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request, scope string) {
	w.Header().Set("Cache-Control", "private, no-store")
	q, e := pagination.ParseCursorQuery(r.URL.Query(), scope)
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	xs, e := h.s.List(r.Context(), user(r), r.URL.Query().Get("search"), r.URL.Query().Get("category"), r.URL.Query().Get("direction_id"), scope, q.Limit+1, pos, id)
	if e != nil {
		h.err(w, r, e)
		return
	}
	page, e := pagination.NewCursorPage(xs, q.Limit, func(x models.StudentProject) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: x.CreatedAt.UTC().Format(time.RFC3339Nano), ID: x.ProjectID}, nil
	})
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) GetReview(w http.ResponseWriter, r *http.Request) {
	project, err := h.s.Get(r.Context(), user(r), r.PathValue("project_id"), true)
	if err != nil {
		h.err(w, r, err)
		return
	}
	if project.Status != "moderation" || project.Visibility != "public" {
		h.err(w, r, studentprojects_service.ErrNotFound)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	pkg.WriteJSON(w, 200, project)
}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	x, e := h.s.Get(r.Context(), user(r), r.PathValue("project_id"), admin(r))
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.StudentProjectInput
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.Create(r.Context(), user(r), in)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var in models.StudentProjectInput
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.Update(r.Context(), user(r), r.PathValue("project_id"), in)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	x, e := h.s.Submit(r.Context(), user(r), r.PathValue("project_id"))
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) UpdateVisibility(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Visibility string `json:"visibility"`
	}
	if !decode(w, r, &input) {
		return
	}
	x, e := h.s.UpdateVisibility(r.Context(), user(r), r.PathValue("project_id"), input.Visibility)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}

func (h *Handler) Moderate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status  string `json:"status"`
		Comment string `json:"comment"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Status == "hidden" && !admin(r) {
		pkg.WriteError(w, http.StatusForbidden, "permission_denied", "Permission denied")
		return
	}
	x, e := h.s.Moderate(r.Context(), user(r), r.PathValue("project_id"), in.Status, in.Comment)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Like(w http.ResponseWriter, r *http.Request) {
	n, e := h.s.Like(r.Context(), user(r), r.PathValue("project_id"), true)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"liked": true, "likes_count": n})
}
func (h *Handler) Unlike(w http.ResponseWriter, r *http.Request) {
	n, e := h.s.Like(r.Context(), user(r), r.PathValue("project_id"), false)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"liked": false, "likes_count": n})
}
func (h *Handler) err(w http.ResponseWriter, r *http.Request, e error) {
	switch {
	case errors.Is(e, studentprojects_service.ErrInvalid), errors.Is(e, studentprojects_service.ErrCursor):
		pkg.WriteError(w, 422, "validation_failed", "Student project data is invalid")
	case errors.Is(e, studentprojects_service.ErrForbidden):
		pkg.WriteError(w, 403, "permission_denied", "Permission denied")
	case errors.Is(e, studentprojects_service.ErrNotFound):
		pkg.WriteError(w, 404, "student_project_not_found", "Student project not found")
	case errors.Is(e, studentprojects_service.ErrTransition):
		pkg.WriteError(w, 409, "invalid_status_transition", "Transition is not allowed")
	default:
		middleware.QueueErrorLog(r.Context(), "student project request failed", e)
		pkg.WriteError(w, 500, "student_project_request_failed", "Student project request failed")
	}
}
