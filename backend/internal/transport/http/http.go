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

	fileRouter := http.NewServeMux()
	apiRouter.Handle("POST /files", h.authorize(http.HandlerFunc(h.handlers.Files.Upload)))
	apiRouter.Handle("/files/", h.authorize(http.StripPrefix("/files", fileRouter)))
	h.handlers.Files.Start(fileRouter)

	apiRouter.HandleFunc("/", shared.NotFound)
}
