package file_handler

import "net/http"

func (h *Handler) StartFeedback(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.Handle("GET /{feedback_id}/files/{file_id}", authorize(http.HandlerFunc(h.DownloadFeedbackFile)))
}
func (h *Handler) StartInternships(mux *http.ServeMux, workflow, optionalAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /applications/{application_id}/resume", workflow(http.HandlerFunc(h.DownloadInternshipResume)))
	mux.Handle("GET /{program_id}/files/{file_id}/content", optionalAuth(http.HandlerFunc(h.DownloadProgramFile)))
}

func (h *Handler) StartUsers(mux *http.ServeMux, authorize, optionalAuth func(http.Handler) http.Handler) {
	mux.Handle("PUT /me/photo", authorize(http.HandlerFunc(h.UploadStudentPhoto)))
	mux.Handle("PUT /me/avatar", authorize(http.HandlerFunc(h.UploadUserAvatar)))
	mux.Handle("GET /{user_id}/avatar", optionalAuth(http.HandlerFunc(h.DownloadUserAvatar)))
}
func (h *Handler) StartCompanies(mux *http.ServeMux, representative func(http.Handler) http.Handler) {
	mux.Handle("PUT /{company_id}/logo", representative(http.HandlerFunc(h.UploadCompanyLogo)))
	mux.HandleFunc("GET /{company_id}/logo", h.DownloadCompanyLogo)
}
func (h *Handler) StartCases(mux *http.ServeMux, authorize, reviewer func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /{case_id}/files/{file_id}", h.DownloadCaseFile)
	mux.HandleFunc("GET /{case_id}/cover", h.DownloadCaseCover)
	mux.Handle("GET /{case_id}/review/files/{file_id}", reviewer(http.HandlerFunc(h.DownloadCaseReviewFile)))
	mux.Handle("GET /{case_id}/protected-files/{file_id}", authorize(http.HandlerFunc(h.DownloadProtectedCaseFile)))
}
func (h *Handler) StartApplications(mux *http.ServeMux) {
	mux.HandleFunc("GET /{application_id}/resume", h.DownloadApplicationResume)
}
func (h *Handler) StartSubmissions(mux *http.ServeMux) {
	mux.HandleFunc("GET /{submission_id}/files/{file_id}", h.DownloadSubmissionFile)
}
func (h *Handler) StartStudentProjects(mux *http.ServeMux, reviewer func(http.Handler) http.Handler) {
	mux.Handle("GET /{project_id}/review/files/{file_id}", reviewer(http.HandlerFunc(h.DownloadStudentProjectReviewFile)))
	mux.HandleFunc("GET /{project_id}/files/{file_id}", h.DownloadStudentProjectFile)
}
func (h *Handler) StartStudents(mux *http.ServeMux) {
	mux.HandleFunc("GET /{student_id}/photo", h.DownloadStudentPhoto)
	mux.HandleFunc("GET /{student_id}/portfolio/files/{file_id}", h.DownloadPortfolioFile)
}
