package studentproject_handler

import "net/http"

func (h *Handler) Start(mux *http.ServeMux, student, admin, reviewer, authorize, optionalAuthorization func(http.Handler) http.Handler) {
	mux.Handle("GET /", optionalAuthorization(http.HandlerFunc(h.List)))
	mux.Handle("GET /mine", student(http.HandlerFunc(h.ListMine)))
	mux.Handle("GET /moderation", reviewer(http.HandlerFunc(h.ListModeration)))
	mux.Handle("GET /{project_id}/review", reviewer(http.HandlerFunc(h.GetReview)))
	mux.Handle("GET /{project_id}", optionalAuthorization(http.HandlerFunc(h.Get)))
	mux.Handle("GET /{project_id}/manage", student(http.HandlerFunc(h.Get)))
	mux.Handle("POST /", student(http.HandlerFunc(h.Create)))
	mux.Handle("PUT /{project_id}", student(http.HandlerFunc(h.Update)))
	mux.Handle("POST /{project_id}/submit-moderation", student(http.HandlerFunc(h.Submit)))
	mux.Handle("PATCH /{project_id}/visibility", student(http.HandlerFunc(h.UpdateVisibility)))
	mux.Handle("PATCH /{project_id}/moderation", reviewer(http.HandlerFunc(h.Moderate)))
	mux.Handle("PUT /{project_id}/like", authorize(http.HandlerFunc(h.Like)))
	mux.Handle("DELETE /{project_id}/like", authorize(http.HandlerFunc(h.Unlike)))
}
