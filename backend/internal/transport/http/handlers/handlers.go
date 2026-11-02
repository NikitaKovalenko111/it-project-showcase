package handlers

import (
	"it-project-showcase/backend/internal/services"
	application_handler "it-project-showcase/backend/internal/transport/http/handlers/application"
	auth_handler "it-project-showcase/backend/internal/transport/http/handlers/auth"
	case_handler "it-project-showcase/backend/internal/transport/http/handlers/case"
	catalog_handler "it-project-showcase/backend/internal/transport/http/handlers/catalog"
	community_handler "it-project-showcase/backend/internal/transport/http/handlers/community"
	company_handler "it-project-showcase/backend/internal/transport/http/handlers/company"
	documentation_handler "it-project-showcase/backend/internal/transport/http/handlers/documentation"
	execution_handler "it-project-showcase/backend/internal/transport/http/handlers/execution"
	file_handler "it-project-showcase/backend/internal/transport/http/handlers/file"
	opportunity_handler "it-project-showcase/backend/internal/transport/http/handlers/opportunity"
	platform_handler "it-project-showcase/backend/internal/transport/http/handlers/platform"
	result_handler "it-project-showcase/backend/internal/transport/http/handlers/result"
	studentproject_handler "it-project-showcase/backend/internal/transport/http/handlers/studentproject"
	system_handler "it-project-showcase/backend/internal/transport/http/handlers/system"
	team_handler "it-project-showcase/backend/internal/transport/http/handlers/team"
	user_handler "it-project-showcase/backend/internal/transport/http/handlers/user"
)

type Handlers struct {
	System          *system_handler.SystemHandler
	Auth            *auth_handler.AuthHandler
	Users           *user_handler.Handler
	Catalogs        *catalog_handler.Handler
	Companies       *company_handler.Handler
	Files           *file_handler.Handler
	Cases           *case_handler.Handler
	Teams           *team_handler.Handler
	Applications    *application_handler.Handler
	Executions      *execution_handler.Handler
	Results         *result_handler.Handler
	StudentProjects *studentproject_handler.Handler
	Platform        *platform_handler.Handler
	Community       *community_handler.Handler
	Opportunities   *opportunity_handler.Handler
	Documentation   *documentation_handler.Handler
}

func Init(services *services.Services) *Handlers {
	return &Handlers{
		System:          system_handler.Init(),
		Auth:            auth_handler.Init(services.Auth),
		Users:           user_handler.Init(services.Users),
		Catalogs:        catalog_handler.Init(services.Catalogs),
		Companies:       company_handler.Init(services.Companies),
		Files:           file_handler.Init(services.Files),
		Cases:           case_handler.Init(services.Cases),
		Teams:           team_handler.Init(services.Teams),
		Applications:    application_handler.Init(services.Applications),
		Executions:      execution_handler.Init(services.Executions),
		Results:         result_handler.Init(services.Results),
		StudentProjects: studentproject_handler.Init(services.StudentProjects),
		Platform:        platform_handler.Init(services.Platform),
		Community:       community_handler.Init(services.Community),
		Opportunities:   opportunity_handler.Init(services.Opportunities),
		Documentation:   documentation_handler.Init(),
	}
}
