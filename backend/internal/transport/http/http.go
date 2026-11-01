package transport

import (
	"net/http"

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

	apiRouter.HandleFunc("/", shared.NotFound)
}
