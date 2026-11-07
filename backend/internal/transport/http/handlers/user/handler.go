package user_handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"it-project-showcase/backend/internal/middleware"
	users_service "it-project-showcase/backend/internal/services/users"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
)

type Handler struct{ service *users_service.Service }

func Init(service *users_service.Service) *Handler { return &Handler{service: service} }

func (h *Handler) Start(mux *http.ServeMux, admin func(http.Handler) http.Handler) {
	mux.Handle("GET /", admin(http.HandlerFunc(h.List)))
	mux.Handle("PATCH /{user_id}/status", admin(http.HandlerFunc(h.SetStatus)))
	mux.HandleFunc("/", shared.NotFound)
}

func (h *Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.PathValue("user_id"))
	var request StatusRequest
	if userID == "" || json.NewDecoder(r.Body).Decode(&request) != nil {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}
	if err := h.service.SetStatus(r.Context(), userID, request.Status); err != nil {
		middleware.QueueErrorLog(r.Context(), "set user status failed", err)
		switch {
		case errors.Is(err, users_service.ErrInvalidStatus):
			pkg.WriteError(w, http.StatusUnprocessableEntity, "invalid_status", "Status must be active, blocked or deleted")
		case errors.Is(err, users_service.ErrNotFound):
			pkg.WriteError(w, http.StatusNotFound, "user_not_found", "User not found")
		default:
			pkg.WriteError(w, http.StatusInternalServerError, "status_update_failed", "Failed to update user status")
		}
		return
	}
	pkg.WriteEmpty(w, http.StatusNoContent)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q, err := pagination.ParsePageQuery(r.URL.Query())
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	users, err := h.service.List(r.Context(), q.PageSize, int(q.Offset))
	if err != nil {
		pkg.WriteError(w, 500, "users_list_failed", "Failed to list users")
		return
	}
	items := make([]map[string]any, 0, len(users))
	for _, u := range users {
		items = append(items, map[string]any{"user_id": u.UserID, "username": u.Username, "email": u.Email, "status": u.Status, "roles": u.Roles, "student": u.Student, "created_at": u.CreatedAt})
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": items})
}
