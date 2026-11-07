package file_handler

import "net/http"

func (h *Handler) StartUsers(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.Handle("PUT /me/photo", authorize(http.HandlerFunc(h.UploadStudentPhoto)))
}
func (h *Handler) StartCompanies(mux *http.ServeMux, representative func(http.Handler) http.Handler) {
	mux.Handle("PUT /{company_id}/logo", representative(http.HandlerFunc(h.UploadCompanyLogo)))
	mux.HandleFunc("GET /{company_id}/logo", h.DownloadCompanyLogo)
}
func (h *Handler) StartCases(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /{case_id}/files/{file_id}", h.DownloadCaseFile)
	mux.HandleFunc("GET /{case_id}/cover", h.DownloadCaseCover)
	mux.Handle("GET /{case_id}/protected-files/{file_id}", authorize(http.HandlerFunc(h.DownloadProtectedCaseFile)))
}
func (h *Handler) StartApplications(mux *http.ServeMux) {
	mux.HandleFunc("GET /{application_id}/resume", h.DownloadApplicationResume)
}
func (h *Handler) StartSubmissions(mux *http.ServeMux) {
	mux.HandleFunc("GET /{submission_id}/files/{file_id}", h.DownloadSubmissionFile)
}
func (h *Handler) StartStudentProjects(mux *http.ServeMux) {
	mux.HandleFunc("GET /{project_id}/files/{file_id}", h.DownloadStudentProjectFile)
}
func (h *Handler) StartStudents(mux *http.ServeMux) {
	mux.HandleFunc("GET /{student_id}/portfolio/files/{file_id}", h.DownloadPortfolioFile)
}
