package user_handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	auth_service "it-project-showcase/backend/internal/services/auth"
	users_service "it-project-showcase/backend/internal/services/users"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
)

type Handler struct{ service *users_service.Service }

func Init(service *users_service.Service) *Handler { return &Handler{service: service} }

func (h *Handler) Start(mux *http.ServeMux, admin func(http.Handler) http.Handler) {
	mux.Handle("GET /{$}", admin(http.HandlerFunc(h.List)))
	mux.Handle("PATCH /{user_id}/status", admin(http.HandlerFunc(h.SetStatus)))
	mux.Handle("PATCH /{user_id}/role-request", admin(http.HandlerFunc(h.ReviewRole)))
	mux.HandleFunc("/", shared.NotFound)
}

func (h *Handler) StartStudents(mux *http.ServeMux, student func(http.Handler) http.Handler) {
	mux.Handle("PUT /me/profile", student(http.HandlerFunc(h.UpdateStudentProfile)))
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	query, err := pagination.ParsePageQuery(r.URL.Query())
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	items, total, err := h.service.List(r.Context(), query.PageSize, query.Offset)
	if err != nil {
		middleware.QueueErrorLog(r.Context(), "list users failed", err)
		pkg.WriteError(w, 500, "users_list_failed", "Failed to list users")
		return
	}
	pkg.WriteJSON(w, 200, pagination.NewPageResponse(items, query, total))
}

func (h *Handler) ReviewRole(w http.ResponseWriter, r *http.Request) {
	var input StatusRequest
	if !decodeStrict(w, r, &input) {
		return
	}
	actor, _ := middleware.UserIDFromContext(r.Context())
	err := h.service.ReviewRole(r.Context(), actor, r.PathValue("user_id"), input.Status)
	switch {
	case err == nil:
		pkg.WriteEmpty(w, 204)
	case errors.Is(err, users_service.ErrNotFound):
		pkg.WriteError(w, 404, "pending_role_request_not_found", "Pending role request not found")
	case errors.Is(err, users_service.ErrInvalidStatus):
		pkg.WriteError(w, 422, "invalid_status", "Status must be approved or rejected")
	default:
		middleware.QueueErrorLog(r.Context(), "review role request failed", err)
		pkg.WriteError(w, 500, "role_review_failed", "Failed to review role request")
	}
}

func (h *Handler) UpdateStudentProfile(w http.ResponseWriter, r *http.Request) {
	var input models.StudentProfileUpdate
	if !decodeStrict(w, r, &input) {
		return
	}
	user, _ := middleware.UserIDFromContext(r.Context())
	err := h.service.UpdateStudentProfile(r.Context(), user, input)
	var invalid *auth_service.ValidationError
	switch {
	case err == nil:
		pkg.WriteEmpty(w, 204)
	case errors.As(err, &invalid):
		pkg.WriteErrorDetails(w, 422, "validation_failed", "Profile data is invalid", []models.ErrorDetail{{Field: invalid.Field, Code: invalid.Code, Message: invalid.Message}})
	case errors.Is(err, users_service.ErrEmailTaken):
		pkg.WriteError(w, 409, "email_taken", "Email is already in use")
	case errors.Is(err, users_service.ErrNotFound):
		pkg.WriteError(w, 404, "student_not_found", "Student profile not found")
	default:
		middleware.QueueErrorLog(r.Context(), "update student profile failed", err)
		pkg.WriteError(w, 500, "profile_update_failed", "Failed to update profile")
	}
}

func decodeStrict(w http.ResponseWriter, r *http.Request, input any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(input); err == nil {
		var extra any
		if errors.Is(decoder.Decode(&extra), io.EOF) {
			return true
		}
	}
	pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
	return false
}

func (h *Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.PathValue("user_id"))
	var request UserStatusRequest
	if userID == "" {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}
	if !decodeStrict(w, r, &request) {
		return
	}
	if err := h.service.SetStatus(r.Context(), userID, request.Status, request.Reason); err != nil {
		middleware.QueueErrorLog(r.Context(), "set user status failed", err)
		switch {
		case errors.Is(err, users_service.ErrInvalidReason):
			pkg.WriteError(w, 422, "invalid_reason", "Причина должна содержать не больше 1000 символов.")
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
