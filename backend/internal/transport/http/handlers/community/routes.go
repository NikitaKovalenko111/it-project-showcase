package community_handler

import "net/http"

func (h *Handler) StartCases(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /{case_id}/comments", h.ListCaseComments)
	mux.Handle("POST /{case_id}/comments", authorize(http.HandlerFunc(h.CreateCaseComment)))
}

func (h *Handler) StartStudentProjects(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /{project_id}/comments", h.ListProjectComments)
	mux.Handle("POST /{project_id}/comments", authorize(http.HandlerFunc(h.CreateProjectComment)))
}

func (h *Handler) StartComments(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.Handle("DELETE /{comment_id}", authorize(http.HandlerFunc(h.DeleteComment)))
	mux.HandleFunc("GET /{comment_id}/replies", h.ListReplies)
	mux.Handle("POST /{comment_id}/replies", authorize(http.HandlerFunc(h.CreateReply)))
}

func (h *Handler) StartReports(mux *http.ServeMux, authorize, admin func(http.Handler) http.Handler) {
	mux.Handle("POST /", authorize(http.HandlerFunc(h.CreateReport)))
	mux.Handle("GET /", admin(http.HandlerFunc(h.ListReports)))
	mux.Handle("PATCH /{report_id}", admin(http.HandlerFunc(h.UpdateReport)))
}
