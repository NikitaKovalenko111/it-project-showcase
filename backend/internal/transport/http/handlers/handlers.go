package handlers

import (
	"it-project-showcase/backend/internal/services"
	auth_handler "it-project-showcase/backend/internal/transport/http/handlers/auth"
	system_handler "it-project-showcase/backend/internal/transport/http/handlers/system"
)

type Handlers struct {
	System *system_handler.SystemHandler
	Auth   *auth_handler.AuthHandler
}

func Init(services *services.Services) *Handlers {
	return &Handlers{
		System: system_handler.Init(),
		Auth:   auth_handler.Init(services.Auth),
	}
}
