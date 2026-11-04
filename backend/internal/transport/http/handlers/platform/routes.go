package platform_handler

import "net/http"

func (h *Handler) StartFavorites(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ListFavorites)
	mux.HandleFunc("PUT /{resource_type}/{resource_id}", h.Favorite)
	mux.HandleFunc("DELETE /{resource_type}/{resource_id}", h.Favorite)
}
func (h *Handler) StartNotifications(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ListNotifications)
	mux.HandleFunc("GET /stream", h.StreamNotifications)
	mux.HandleFunc("PATCH /{notification_id}/read", h.ReadNotification)
	mux.HandleFunc("POST /read-all", h.ReadAll)
}
func (h *Handler) StartAuditLogs(mux *http.ServeMux) { mux.HandleFunc("GET /", h.ListAudit) }
func (h *Handler) StartStudents(mux *http.ServeMux, search func(http.Handler) http.Handler) {
	mux.Handle("GET /search", search(http.HandlerFunc(h.SearchStudents)))
	mux.HandleFunc("GET /{student_id}/portfolio", h.GetPortfolio)
}
func (h *Handler) StartPortfolio(mux *http.ServeMux) {
	mux.HandleFunc("GET /me", h.GetMyPortfolio)
	mux.HandleFunc("PATCH /me", h.UpdatePortfolio)
}
func (h *Handler) StartAnalytics(mux *http.ServeMux) { mux.HandleFunc("GET /", h.Analytics) }
func (h *Handler) StartExports(mux *http.ServeMux)   { mux.HandleFunc("GET /", h.Export) }
