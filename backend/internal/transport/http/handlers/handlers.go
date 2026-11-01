package handlers

import (
	"it-project-showcase/backend/internal/services"
	application_handler "it-project-showcase/backend/internal/transport/http/handlers/application"
	auth_handler "it-project-showcase/backend/internal/transport/http/handlers/auth"
	case_handler "it-project-showcase/backend/internal/transport/http/handlers/case"
	catalog_handler "it-project-showcase/backend/internal/transport/http/handlers/catalog"
	company_handler "it-project-showcase/backend/internal/transport/http/handlers/company"
	execution_handler "it-project-showcase/backend/internal/transport/http/handlers/execution"
	file_handler "it-project-showcase/backend/internal/transport/http/handlers/file"
	system_handler "it-project-showcase/backend/internal/transport/http/handlers/system"
	team_handler "it-project-showcase/backend/internal/transport/http/handlers/team"
	user_handler "it-project-showcase/backend/internal/transport/http/handlers/user"
)

type Handlers struct {
	System       *system_handler.SystemHandler
	Auth         *auth_handler.AuthHandler
	Users        *user_handler.Handler
	Catalogs     *catalog_handler.Handler
	Companies    *company_handler.Handler
	Files        *file_handler.Handler
	Cases        *case_handler.Handler
	Teams        *team_handler.Handler
	Applications *application_handler.Handler
	Executions   *execution_handler.Handler
}

func Init(services *services.Services) *Handlers {
	return &Handlers{
		System:       system_handler.Init(),
		Auth:         auth_handler.Init(services.Auth),
		Users:        user_handler.Init(services.Users),
		Catalogs:     catalog_handler.Init(services.Catalogs),
		Companies:    company_handler.Init(services.Companies),
		Files:        file_handler.Init(services.Files),
		Cases:        case_handler.Init(services.Cases),
		Teams:        team_handler.Init(services.Teams),
		Applications: application_handler.Init(services.Applications),
		Executions:   execution_handler.Init(services.Executions),
	}
}
