package opportunity_handler

import "net/http"

func (h *Handler) StartTeams(mux *http.ServeMux, student func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /", h.ListTeams)
	mux.Handle("PUT /{team_id}/discovery", student(http.HandlerFunc(h.UpdateTeam)))
	mux.Handle("POST /{team_id}/join-applications", student(http.HandlerFunc(h.ApplyTeam)))
	mux.Handle("GET /{team_id}/join-applications", student(http.HandlerFunc(h.ListTeamApplications)))
}
func (h *Handler) StartTeamApplications(mux *http.ServeMux) {
	mux.HandleFunc("GET /mine", h.ListMyTeamApplications)
	mux.HandleFunc("PATCH /{application_id}", h.RespondTeamApplication)
}
func (h *Handler) StartTeamSearchProfile(mux *http.ServeMux) {
	mux.HandleFunc("PUT /me", h.UpsertTeamProfile)
}
func (h *Handler) StartTeamSearchProfiles(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ListTeamProfiles)
}
func (h *Handler) StartInternships(mux *http.ServeMux, representative, reviewer, authorize, optionalAuthorization func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /", h.ListInternships)
	mux.Handle("GET /mine", representative(http.HandlerFunc(h.ListMyInternships)))
	mux.Handle("GET /moderation", reviewer(http.HandlerFunc(h.ListInternshipModeration)))
	mux.Handle("GET /{program_id}", optionalAuthorization(http.HandlerFunc(h.GetInternship)))
	mux.Handle("POST /", representative(http.HandlerFunc(h.CreateInternship)))
	mux.Handle("PUT /{program_id}", representative(http.HandlerFunc(h.UpdateInternship)))
	mux.Handle("PATCH /{program_id}/status", authorize(http.HandlerFunc(h.UpdateInternshipStatus)))
}
func (h *Handler) StartCases(mux *http.ServeMux, representative, manager, studentOnly, optionalAuthorization func(http.Handler) http.Handler) {
	mux.Handle("GET /{case_id}/leaderboard", optionalAuthorization(http.HandlerFunc(h.Leaderboard)))
	mux.Handle("PUT /{case_id}/leaderboard/placements", manager(http.HandlerFunc(h.SetPlacements)))
	mux.Handle("DELETE /{case_id}/leaderboard/placements", manager(http.HandlerFunc(h.WithdrawPlacements)))
	mux.Handle("PUT /{case_id}/cover", representative(http.HandlerFunc(h.SetCaseCover)))
	mux.Handle("POST /{case_id}/nda-grants", studentOnly(http.HandlerFunc(h.AcceptNDA)))
	mux.HandleFunc("GET /{case_id}/nda", h.GetNDA)
	mux.Handle("POST /{case_id}/nda-versions", representative(http.HandlerFunc(h.CreateNDA)))
}
func (h *Handler) StartStudents(mux *http.ServeMux, authorize, admin, curator func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /{student_id}/portfolio/files", h.ListPublicPortfolioFiles)
	mux.HandleFunc("GET /{student_id}/rating", h.Rating)
	mux.Handle("GET /{student_id}/curator", authorize(http.HandlerFunc(h.GetCurator)))
	mux.Handle("PUT /{student_id}/curator", admin(http.HandlerFunc(h.SetCurator)))
	mux.Handle("PUT /{student_id}/curator/self", curator(http.HandlerFunc(h.AssignSelfCurator)))
	mux.Handle("DELETE /{student_id}/curator", admin(http.HandlerFunc(h.RevokeCurator)))
}
func (h *Handler) StartPortfolio(mux *http.ServeMux) {
	mux.HandleFunc("POST /me/files", h.AttachPortfolioFile)
	mux.HandleFunc("GET /me/files", h.ListMyPortfolioFiles)
	mux.HandleFunc("DELETE /me/files/{file_id}", h.DetachPortfolioFile)
}
func (h *Handler) StartApplicationDefaults(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ApplicationDefaults)
}
