package execution_handler

import "net/http"

func (h *Handler) StartCases(mux *http.ServeMux, workflow func(http.Handler) http.Handler) {
	mux.Handle("GET /{case_id}/nda-grants", workflow(http.HandlerFunc(h.ListNDA)))
}
func (h *Handler) StartNDAGrants(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /{grant_id}", h.UpdateNDA)
}
