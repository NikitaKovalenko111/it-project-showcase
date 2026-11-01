package handlers

import (
	"it-project-showcase/backend/internal/services"
	auth_handler "it-project-showcase/backend/internal/transport/http/handlers/auth"
	catalog_handler "it-project-showcase/backend/internal/transport/http/handlers/catalog"
	company_handler "it-project-showcase/backend/internal/transport/http/handlers/company"
	system_handler "it-project-showcase/backend/internal/transport/http/handlers/system"
	user_handler "it-project-showcase/backend/internal/transport/http/handlers/user"
)

type Handlers struct {
	System    *system_handler.SystemHandler
	Auth      *auth_handler.AuthHandler
	Users     *user_handler.Handler
	Catalogs  *catalog_handler.Handler
	Companies *company_handler.Handler
}

func Init(services *services.Services) *Handlers {
	return &Handlers{
		System:    system_handler.Init(),
		Auth:      auth_handler.Init(services.Auth),
		Users:     user_handler.Init(services.Users),
		Catalogs:  catalog_handler.Init(services.Catalogs),
		Companies: company_handler.Init(services.Companies),
	}
}
