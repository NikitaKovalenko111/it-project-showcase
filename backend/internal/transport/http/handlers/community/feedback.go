package community_handler

import (
	"net/http"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
)

func (h *Handler) StartFeedback(mux *http.ServeMux, authorize, admin func(http.Handler) http.Handler) {
	mux.Handle("POST /{$}", authorize(http.HandlerFunc(h.CreateFeedback)))
	mux.Handle("GET /{$}", admin(http.HandlerFunc(h.ListFeedback)))
	mux.Handle("GET /mine", authorize(http.HandlerFunc(h.ListMyFeedback)))
	mux.Handle("PATCH /{feedback_id}/status", admin(http.HandlerFunc(h.ReviewFeedback)))
}

func (h *Handler) CreateFeedback(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Body    string   `json:"body"`
		FileIDs []string `json:"file_ids"`
	}
	if !decode(w, r, &input) {
		return
	}
	user, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.CreateFeedback(r.Context(), user, input.Body, input.FileIDs)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}

func (h *Handler) ListFeedback(w http.ResponseWriter, r *http.Request) {
	h.listFeedback(w, r, true)
}

func (h *Handler) ListMyFeedback(w http.ResponseWriter, r *http.Request) {
	h.listFeedback(w, r, false)
}

func (h *Handler) listFeedback(w http.ResponseWriter, r *http.Request, admin bool) {
	query, err := pagination.ParsePageQuery(r.URL.Query())
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	user, _ := middleware.UserIDFromContext(r.Context())
	items, total, err := h.service.ListFeedback(r.Context(), user, r.URL.Query().Get("status"), admin, query.PageSize, query.Offset)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, pagination.NewPageResponse(items, query, total))
}

func (h *Handler) ReviewFeedback(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &input) {
		return
	}
	user, _ := middleware.UserIDFromContext(r.Context())
	if err := h.service.ReviewFeedback(r.Context(), user, r.PathValue("feedback_id"), input.Status); err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteEmpty(w, http.StatusNoContent)
}
