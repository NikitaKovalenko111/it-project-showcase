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

	fileRouter := http.NewServeMux()
	apiRouter.Handle("POST /files", h.authorize(http.HandlerFunc(h.handlers.Files.Upload)))
	apiRouter.Handle("/files/", h.authorize(http.StripPrefix("/files", fileRouter)))
	h.handlers.Files.Start(fileRouter)

	apiRouter.HandleFunc("/", shared.NotFound)
}
