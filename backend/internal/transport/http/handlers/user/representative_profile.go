package user_handler

import (
	"errors"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	users_service "it-project-showcase/backend/internal/services/users"
	"it-project-showcase/backend/pkg"
	"net/http"
)

func (h *Handler) StartRepresentativeProfile(mux *http.ServeMux, representative func(http.Handler) http.Handler) {
	mux.Handle("GET /me/representative-profile", representative(http.HandlerFunc(h.GetRepresentativeProfile)))
	mux.Handle("PATCH /me/representative-profile", representative(http.HandlerFunc(h.UpdateRepresentativeProfile)))
}
func (h *Handler) GetRepresentativeProfile(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserIDFromContext(r.Context())
	p, err := h.service.GetRepresentativeProfile(r.Context(), user)
	h.writeRepresentativeProfile(w, r, p, err)
}
func (h *Handler) UpdateRepresentativeProfile(w http.ResponseWriter, r *http.Request) {
	var input models.RepresentativeProfilePatch
	if !decodeStrict(w, r, &input) {
		return
	}
	user, _ := middleware.UserIDFromContext(r.Context())
	p, err := h.service.UpdateRepresentativeProfile(r.Context(), user, input)
	h.writeRepresentativeProfile(w, r, p, err)
}
func (h *Handler) writeRepresentativeProfile(w http.ResponseWriter, r *http.Request, p *models.RepresentativeProfile, err error) {
	switch {
	case err == nil:
		pkg.WriteJSON(w, 200, p)
	case errors.Is(err, users_service.ErrInvalidRepresentativeProfile):
		pkg.WriteError(w, 422, "invalid_representative_profile", "Provide experience_and_interests (up to 4000 characters) or help_topics (up to 2000 characters)")
	case errors.Is(err, users_service.ErrNotFound):
		pkg.WriteError(w, 404, "user_not_found", "Representative profile not found")
	default:
		middleware.QueueErrorLog(r.Context(), "representative profile request failed", err)
		pkg.WriteError(w, 500, "profile_request_failed", "Failed to process representative profile")
	}
}
