package community_handler

import "net/http"

func (h *Handler) StartCases(mux *http.ServeMux, authorize, optionalAuthorization func(http.Handler) http.Handler) {
	mux.Handle("GET /{case_id}/comments", optionalAuthorization(http.HandlerFunc(h.ListCaseComments)))
	mux.Handle("POST /{case_id}/comments", authorize(http.HandlerFunc(h.CreateCaseComment)))
}

func (h *Handler) StartStudentProjects(mux *http.ServeMux, authorize, optionalAuthorization func(http.Handler) http.Handler) {
	mux.Handle("GET /{project_id}/comments", optionalAuthorization(http.HandlerFunc(h.ListProjectComments)))
	mux.Handle("POST /{project_id}/comments", authorize(http.HandlerFunc(h.CreateProjectComment)))
}

func (h *Handler) StartComments(mux *http.ServeMux, authorize, optionalAuthorization func(http.Handler) http.Handler) {
	mux.Handle("DELETE /{comment_id}", authorize(http.HandlerFunc(h.DeleteComment)))
	mux.Handle("GET /{comment_id}/replies", optionalAuthorization(http.HandlerFunc(h.ListReplies)))
	mux.Handle("PUT /{comment_id}/like", authorize(http.HandlerFunc(h.SetCommentLike)))
	mux.Handle("DELETE /{comment_id}/like", authorize(http.HandlerFunc(h.SetCommentLike)))
	mux.Handle("POST /{comment_id}/replies", authorize(http.HandlerFunc(h.CreateReply)))
}

func (h *Handler) StartReports(mux *http.ServeMux, authorize, admin func(http.Handler) http.Handler) {
	mux.Handle("POST /", authorize(http.HandlerFunc(h.CreateReport)))
	mux.Handle("GET /", admin(http.HandlerFunc(h.ListReports)))
	mux.Handle("PATCH /{report_id}", admin(http.HandlerFunc(h.UpdateReport)))
}
