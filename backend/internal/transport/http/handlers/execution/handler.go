package execution_handler

import (
	"encoding/json"
	"errors"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	executions_service "it-project-showcase/backend/internal/services/executions"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"net/http"
	"time"
)

type Handler struct{ service *executions_service.Service }

func Init(s *executions_service.Service) *Handler { return &Handler{service: s} }
func (h *Handler) Start(m *http.ServeMux) {
	m.HandleFunc("GET /{execution_id}/stages", h.ListStages)
	m.HandleFunc("PATCH /{execution_id}/stages/{stage_id}", h.UpdateStage)
	m.HandleFunc("GET /{execution_id}/comments", h.ListComments)
	m.HandleFunc("POST /{execution_id}/comments", h.AddComment)
	m.HandleFunc("POST /{execution_id}/mentors", h.AddMentor)
	m.HandleFunc("GET /{execution_id}/mentors", h.ListMentors)
	m.HandleFunc("PATCH /{execution_id}/status", h.UpdateExecutionStatus)
}
func (h *Handler) ListMentors(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserIDFromContext(r.Context())
	c, a := roles(r)
	x, e := h.service.ListMentors(r.Context(), u, r.PathValue("execution_id"), c, a)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) UpdateExecutionStatus(w http.ResponseWriter, r *http.Request) {
	var q struct {
		Status string `json:"status"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	c, _ := roles(r)
	x, e := h.service.UpdateExecutionStatus(r.Context(), u, r.PathValue("execution_id"), q.Status, c)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) ListNDA(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserIDFromContext(r.Context())
	c, a := roles(r)
	x, e := h.service.ListNDA(r.Context(), u, r.PathValue("case_id"), c, a)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func roles(r *http.Request) (bool, bool) {
	c, a := false, false
	if x, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, v := range x.Roles {
			if v == "company_representative" {
				c = true
			}
			if v == "admin" {
				a = true
			}
		}
	}
	return c, a
}
func (h *Handler) ListStages(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserIDFromContext(r.Context())
	c, a := roles(r)
	x, e := h.service.ListStages(r.Context(), u, r.PathValue("execution_id"), c, a)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) UpdateStage(w http.ResponseWriter, r *http.Request) {
	var q struct {
		Status   string `json:"status"`
		Feedback string `json:"feedback"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	c, _ := roles(r)
	x, e := h.service.UpdateStage(r.Context(), u, r.PathValue("execution_id"), r.PathValue("stage_id"), q.Status, q.Feedback, c)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) AddComment(w http.ResponseWriter, r *http.Request) {
	var q struct {
		StageID string `json:"stage_id"`
		Body    string `json:"body"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	c, a := roles(r)
	x, e := h.service.AddComment(r.Context(), u, r.PathValue("execution_id"), q.StageID, q.Body, c, a)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	q, e := pagination.ParseCursorQuery(r.URL.Query(), "execution-comments-"+r.PathValue("execution_id"))
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	c, a := roles(r)
	items, e := h.service.ListComments(r.Context(), u, r.PathValue("execution_id"), c, a, q.Limit+1, pos, id)
	if e != nil {
		h.err(w, r, e)
		return
	}
	page, e := pagination.NewCursorPage(items, q.Limit, func(x models.ExecutionComment) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: "execution-comments-" + r.PathValue("execution_id"), Position: x.CreatedAt.UTC().Format(time.RFC3339Nano), ID: x.CommentID}, nil
	})
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) AddMentor(w http.ResponseWriter, r *http.Request) {
	var q struct {
		UserID   string `json:"user_id"`
		RoleName string `json:"role_name"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.AddMentor(r.Context(), u, r.PathValue("execution_id"), q.UserID, q.RoleName)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) RequestNDA(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.RequestNDA(r.Context(), u, r.PathValue("case_id"))
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) UpdateNDA(w http.ResponseWriter, r *http.Request) {
	var q struct {
		Status         string `json:"status"`
		EvidenceFileID string `json:"evidence_file_id"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, e := h.service.UpdateNDA(r.Context(), u, r.PathValue("grant_id"), q.Status, q.EvidenceFileID)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) err(w http.ResponseWriter, r *http.Request, e error) {
	switch {
	case errors.Is(e, executions_service.ErrInvalid):
		pkg.WriteError(w, 422, "validation_failed", "Execution data is invalid")
	case errors.Is(e, executions_service.ErrForbidden):
		pkg.WriteError(w, 403, "execution_access_denied", "Execution access denied")
	case errors.Is(e, executions_service.ErrTransition):
		pkg.WriteError(w, 409, "invalid_execution_transition", "Transition is not allowed")
	default:
		middleware.QueueErrorLog(r.Context(), "execution request failed", e)
		pkg.WriteError(w, 500, "execution_request_failed", "Execution request failed")
	}
}
