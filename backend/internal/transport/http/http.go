package transport

import (
	"net/http"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/transport/http/handlers"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
)

type HTTP struct {
	handlers  *handlers.Handlers
	authorize func(http.Handler) http.Handler
}

func Init(handlers *handlers.Handlers, authorize func(http.Handler) http.Handler) *HTTP {
	return &HTTP{
		handlers:  handlers,
		authorize: authorize,
	}
}

func (h *HTTP) Start(mux *http.ServeMux) {
	apiRouter := http.NewServeMux()
	mux.Handle(
		"/api/v1/",
		http.StripPrefix("/api/v1", apiRouter),
	)

	systemRouter := http.NewServeMux()
	apiRouter.Handle(
		"/system/",
		http.StripPrefix("/system", systemRouter),
	)
	h.handlers.System.Start(systemRouter)
	apiRouter.HandleFunc("GET /docs", h.handlers.Documentation.UI)
	apiRouter.HandleFunc("GET /docs/", h.handlers.Documentation.UI)
	apiRouter.HandleFunc("GET /docs/openapi.yaml", h.handlers.Documentation.Spec)

	authRouter := http.NewServeMux()
	apiRouter.Handle(
		"/auth/",
		http.StripPrefix("/auth", authRouter),
	)
	h.handlers.Auth.StartPublic(authRouter)
	h.handlers.Auth.StartProtected(authRouter, h.authorize)

	usersRouter := http.NewServeMux()
	apiRouter.Handle(
		"/users/",
		h.authorize(middleware.RequireAnyRole("admin")(http.StripPrefix("/users", usersRouter))),
	)
	h.handlers.Users.Start(usersRouter)
	apiRouter.Handle("PUT /users/me/photo", h.authorize(http.HandlerFunc(h.handlers.Files.UploadStudentPhoto)))

	admin := func(next http.Handler) http.Handler { return h.authorize(middleware.RequireAnyRole("admin")(next)) }
	representative := func(next http.Handler) http.Handler {
		return h.authorize(middleware.RequireAnyRole("company_representative")(next))
	}
	manager := func(next http.Handler) http.Handler {
		return h.authorize(middleware.RequireAnyRole("company_representative", "admin")(next))
	}
	catalogRouter := http.NewServeMux()
	apiRouter.Handle("/catalogs/", http.StripPrefix("/catalogs", catalogRouter))
	h.handlers.Catalogs.Start(catalogRouter, admin)
	companyRouter := http.NewServeMux()
	apiRouter.Handle("GET /companies", http.HandlerFunc(h.handlers.Companies.List))
	apiRouter.Handle("POST /companies", representative(http.HandlerFunc(h.handlers.Companies.Create)))
	apiRouter.Handle("PUT /companies/{company_id}/logo", representative(http.HandlerFunc(h.handlers.Files.UploadCompanyLogo)))
	apiRouter.HandleFunc("GET /companies/{company_id}/logo", h.handlers.Files.DownloadCompanyLogo)
	apiRouter.Handle("/companies/", http.StripPrefix("/companies", companyRouter))
	h.handlers.Companies.Start(companyRouter, representative, admin)

	caseRouter := http.NewServeMux()
	apiRouter.Handle("GET /cases", http.HandlerFunc(h.handlers.Cases.List))
	apiRouter.Handle("POST /cases", representative(http.HandlerFunc(h.handlers.Cases.Create)))
	apiRouter.HandleFunc("GET /cases/{case_id}/files/{file_id}", h.handlers.Files.DownloadCaseFile)
	apiRouter.HandleFunc("GET /cases/{case_id}/cover", h.handlers.Files.DownloadCaseCover)
	apiRouter.Handle("GET /cases/{case_id}/protected-files/{file_id}", h.authorize(http.HandlerFunc(h.handlers.Files.DownloadProtectedCaseFile)))
	apiRouter.Handle("/cases/", http.StripPrefix("/cases", caseRouter))
	h.handlers.Cases.Start(caseRouter, representative, manager, admin)

	studentArea := func(next http.Handler) http.Handler {
		return h.authorize(middleware.RequireAnyRole("student", "admin")(next))
	}
	teamRouter := http.NewServeMux()
	apiRouter.Handle("/teams/", studentArea(http.StripPrefix("/teams", teamRouter)))
	apiRouter.Handle("POST /teams", studentArea(http.HandlerFunc(h.handlers.Teams.Create)))
	h.handlers.Teams.StartTeams(teamRouter)
	invitationRouter := http.NewServeMux()
	apiRouter.Handle("/team-invitations/", studentArea(http.StripPrefix("/team-invitations", invitationRouter)))
	apiRouter.Handle("GET /team-invitations", studentArea(http.HandlerFunc(h.handlers.Teams.ListInvitations)))
	h.handlers.Teams.StartInvitations(invitationRouter)
	apiRouter.HandleFunc("GET /teams", h.handlers.Opportunities.ListTeams)
	apiRouter.Handle("PUT /teams/{team_id}/discovery", studentArea(http.HandlerFunc(h.handlers.Opportunities.UpdateTeam)))
	apiRouter.Handle("POST /teams/{team_id}/join-applications", studentArea(http.HandlerFunc(h.handlers.Opportunities.ApplyTeam)))
	apiRouter.Handle("GET /teams/{team_id}/join-applications", studentArea(http.HandlerFunc(h.handlers.Opportunities.ListTeamApplications)))
	apiRouter.Handle("PATCH /team-join-applications/{application_id}", studentArea(http.HandlerFunc(h.handlers.Opportunities.RespondTeamApplication)))
	apiRouter.Handle("PUT /team-search-profile/me", studentArea(http.HandlerFunc(h.handlers.Opportunities.UpsertTeamProfile)))
	apiRouter.Handle("GET /team-search-profiles", studentArea(http.HandlerFunc(h.handlers.Opportunities.ListTeamProfiles)))

	workflowArea := func(next http.Handler) http.Handler {
		return h.authorize(middleware.RequireAnyRole("student", "company_representative", "admin")(next))
	}
	applicationRouter := http.NewServeMux()
	apiRouter.Handle("/applications/", workflowArea(http.StripPrefix("/applications", applicationRouter)))
	apiRouter.Handle("GET /applications", workflowArea(http.HandlerFunc(h.handlers.Applications.List)))
	apiRouter.Handle("POST /applications", workflowArea(http.HandlerFunc(h.handlers.Applications.Create)))
	apiRouter.Handle("GET /applications/{application_id}/resume", workflowArea(http.HandlerFunc(h.handlers.Files.DownloadApplicationResume)))
	h.handlers.Applications.StartApplications(applicationRouter)
	executionRouter := http.NewServeMux()
	apiRouter.Handle("/executions/", workflowArea(http.StripPrefix("/executions", executionRouter)))
	h.handlers.Applications.StartExecutions(executionRouter)
	h.handlers.Executions.Start(executionRouter)
	h.handlers.Results.StartExecution(executionRouter)
	h.handlers.Results.StartTop(apiRouter, workflowArea)
	apiRouter.Handle("GET /submissions/{submission_id}/files/{file_id}", workflowArea(http.HandlerFunc(h.handlers.Files.DownloadSubmissionFile)))

	apiRouter.HandleFunc("GET /student-projects", h.handlers.StudentProjects.List)
	apiRouter.HandleFunc("GET /student-projects/{project_id}", h.handlers.StudentProjects.Get)
	apiRouter.Handle("GET /student-projects/{project_id}/manage", studentArea(http.HandlerFunc(h.handlers.StudentProjects.Get)))
	apiRouter.HandleFunc("GET /student-projects/{project_id}/files/{file_id}", h.handlers.Files.DownloadStudentProjectFile)
	apiRouter.Handle("POST /student-projects", studentArea(http.HandlerFunc(h.handlers.StudentProjects.Create)))
	apiRouter.Handle("PUT /student-projects/{project_id}", studentArea(http.HandlerFunc(h.handlers.StudentProjects.Update)))
	apiRouter.Handle("POST /student-projects/{project_id}/submit-moderation", studentArea(http.HandlerFunc(h.handlers.StudentProjects.Submit)))
	apiRouter.Handle("PATCH /student-projects/{project_id}/moderation", admin(http.HandlerFunc(h.handlers.StudentProjects.Moderate)))
	apiRouter.Handle("PUT /student-projects/{project_id}/like", h.authorize(http.HandlerFunc(h.handlers.StudentProjects.Like)))
	apiRouter.Handle("DELETE /student-projects/{project_id}/like", h.authorize(http.HandlerFunc(h.handlers.StudentProjects.Unlike)))
	apiRouter.HandleFunc("GET /student-projects/{project_id}/comments", h.handlers.Community.ListProjectComments)
	apiRouter.Handle("POST /student-projects/{project_id}/comments", h.authorize(http.HandlerFunc(h.handlers.Community.CreateProjectComment)))
	apiRouter.HandleFunc("GET /cases/{case_id}/comments", h.handlers.Community.ListCaseComments)
	apiRouter.Handle("POST /cases/{case_id}/comments", h.authorize(http.HandlerFunc(h.handlers.Community.CreateCaseComment)))
	apiRouter.Handle("DELETE /comments/{comment_id}", h.authorize(http.HandlerFunc(h.handlers.Community.DeleteComment)))
	apiRouter.HandleFunc("GET /comments/{comment_id}/replies", h.handlers.Community.ListReplies)
	apiRouter.Handle("POST /comments/{comment_id}/replies", h.authorize(http.HandlerFunc(h.handlers.Community.CreateReply)))
	apiRouter.Handle("POST /reports", h.authorize(http.HandlerFunc(h.handlers.Community.CreateReport)))
	apiRouter.Handle("GET /reports", admin(http.HandlerFunc(h.handlers.Community.ListReports)))
	apiRouter.Handle("PATCH /reports/{report_id}", admin(http.HandlerFunc(h.handlers.Community.UpdateReport)))

	apiRouter.HandleFunc("GET /internships", h.handlers.Opportunities.ListInternships)
	apiRouter.HandleFunc("GET /internships/{program_id}", h.handlers.Opportunities.GetInternship)
	apiRouter.Handle("POST /internships", representative(http.HandlerFunc(h.handlers.Opportunities.CreateInternship)))
	apiRouter.Handle("PATCH /internships/{program_id}/status", h.authorize(http.HandlerFunc(h.handlers.Opportunities.UpdateInternshipStatus)))
	apiRouter.HandleFunc("GET /cases/{case_id}/leaderboard", h.handlers.Opportunities.Leaderboard)
	apiRouter.Handle("PUT /cases/{case_id}/leaderboard/placements", manager(http.HandlerFunc(h.handlers.Opportunities.SetPlacements)))
	apiRouter.Handle("PUT /cases/{case_id}/cover", representative(http.HandlerFunc(h.handlers.Opportunities.SetCaseCover)))

	apiRouter.Handle("GET /favorites", h.authorize(http.HandlerFunc(h.handlers.Platform.ListFavorites)))
	apiRouter.Handle("PUT /favorites/{resource_type}/{resource_id}", h.authorize(http.HandlerFunc(h.handlers.Platform.Favorite)))
	apiRouter.Handle("DELETE /favorites/{resource_type}/{resource_id}", h.authorize(http.HandlerFunc(h.handlers.Platform.Favorite)))
	apiRouter.Handle("GET /notifications", h.authorize(http.HandlerFunc(h.handlers.Platform.ListNotifications)))
	apiRouter.Handle("GET /notifications/stream", h.authorize(http.HandlerFunc(h.handlers.Platform.StreamNotifications)))
	apiRouter.Handle("PATCH /notifications/{notification_id}/read", h.authorize(http.HandlerFunc(h.handlers.Platform.ReadNotification)))
	apiRouter.Handle("POST /notifications/read-all", h.authorize(http.HandlerFunc(h.handlers.Platform.ReadAll)))
	apiRouter.Handle("GET /audit-logs", admin(http.HandlerFunc(h.handlers.Platform.ListAudit)))
	studentSearch := func(next http.Handler) http.Handler {
		return h.authorize(middleware.RequireAnyRole("company_representative", "university_staff", "admin")(next))
	}
	apiRouter.Handle("GET /students/search", studentSearch(http.HandlerFunc(h.handlers.Platform.SearchStudents)))
	apiRouter.HandleFunc("GET /students/{student_id}/portfolio", h.handlers.Platform.GetPortfolio)
	apiRouter.Handle("GET /portfolio/me", studentArea(http.HandlerFunc(h.handlers.Platform.GetMyPortfolio)))
	apiRouter.Handle("PATCH /portfolio/me", studentArea(http.HandlerFunc(h.handlers.Platform.UpdatePortfolio)))
	apiRouter.Handle("POST /portfolio/me/files", studentArea(http.HandlerFunc(h.handlers.Opportunities.AttachPortfolioFile)))
	apiRouter.Handle("GET /portfolio/me/files", studentArea(http.HandlerFunc(h.handlers.Opportunities.ListMyPortfolioFiles)))
	apiRouter.Handle("DELETE /portfolio/me/files/{file_id}", studentArea(http.HandlerFunc(h.handlers.Opportunities.DetachPortfolioFile)))
	apiRouter.HandleFunc("GET /students/{student_id}/portfolio/files", h.handlers.Opportunities.ListPublicPortfolioFiles)
	apiRouter.HandleFunc("GET /students/{student_id}/portfolio/files/{file_id}", h.handlers.Files.DownloadPortfolioFile)
	apiRouter.HandleFunc("GET /students/{student_id}/rating", h.handlers.Opportunities.Rating)
	apiRouter.Handle("GET /application-defaults", studentArea(http.HandlerFunc(h.handlers.Opportunities.ApplicationDefaults)))
	apiRouter.Handle("GET /students/{student_id}/curator", h.authorize(http.HandlerFunc(h.handlers.Opportunities.GetCurator)))
	apiRouter.Handle("PUT /students/{student_id}/curator", admin(http.HandlerFunc(h.handlers.Opportunities.SetCurator)))
	apiRouter.Handle("DELETE /students/{student_id}/curator", admin(http.HandlerFunc(h.handlers.Opportunities.RevokeCurator)))
	apiRouter.Handle("GET /analytics", manager(http.HandlerFunc(h.handlers.Platform.Analytics)))
	apiRouter.Handle("GET /exports", manager(http.HandlerFunc(h.handlers.Platform.Export)))
	apiRouter.Handle("POST /cases/{case_id}/nda-grants", h.authorize(middleware.RequireAnyRole("student")(http.HandlerFunc(h.handlers.Opportunities.AcceptNDA))))
	apiRouter.HandleFunc("GET /cases/{case_id}/nda", h.handlers.Opportunities.GetNDA)
	apiRouter.Handle("POST /cases/{case_id}/nda-versions", representative(http.HandlerFunc(h.handlers.Opportunities.CreateNDA)))
	apiRouter.Handle("GET /cases/{case_id}/nda-grants", workflowArea(http.HandlerFunc(h.handlers.Executions.ListNDA)))
	apiRouter.Handle("PATCH /nda-grants/{grant_id}", representative(http.HandlerFunc(h.handlers.Executions.UpdateNDA)))
	apiRouter.Handle("PATCH /company-member-invitations/{invitation_id}", h.authorize(http.HandlerFunc(h.handlers.Companies.RespondMemberInvitation)))
	apiRouter.Handle("GET /company-member-invitations", h.authorize(http.HandlerFunc(h.handlers.Companies.ListMemberInvitations)))
	apiRouter.Handle("PATCH /company-invitations/{invitation_id}", h.authorize(middleware.RequireAnyRole("student")(http.HandlerFunc(h.handlers.Companies.RespondStudentInvitation))))
	apiRouter.Handle("GET /company-invitations", h.authorize(middleware.RequireAnyRole("student")(http.HandlerFunc(h.handlers.Companies.ListStudentInvitations))))

	fileRouter := http.NewServeMux()
	apiRouter.Handle("POST /files", h.authorize(http.HandlerFunc(h.handlers.Files.Upload)))
	apiRouter.Handle("/files/", h.authorize(http.StripPrefix("/files", fileRouter)))
	h.handlers.Files.Start(fileRouter)

	apiRouter.HandleFunc("/", shared.NotFound)
}
