package services

import (
	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/objectstorage"
	applications_service "it-project-showcase/backend/internal/services/applications"
	auth_service "it-project-showcase/backend/internal/services/auth"
	cases_service "it-project-showcase/backend/internal/services/cases"
	catalogs_service "it-project-showcase/backend/internal/services/catalogs"
	companies_service "it-project-showcase/backend/internal/services/companies"
	files_service "it-project-showcase/backend/internal/services/files"
	teams_service "it-project-showcase/backend/internal/services/teams"
	users_service "it-project-showcase/backend/internal/services/users"
	"it-project-showcase/backend/internal/storage"
	application_repo "it-project-showcase/backend/internal/storage/repositories/application"
	case_repo "it-project-showcase/backend/internal/storage/repositories/case"
	catalog_repo "it-project-showcase/backend/internal/storage/repositories/catalog"
	company_repo "it-project-showcase/backend/internal/storage/repositories/company"
	file_repo "it-project-showcase/backend/internal/storage/repositories/file"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	team_repo "it-project-showcase/backend/internal/storage/repositories/team"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
)

type Services struct {
	Auth         *auth_service.AuthService
	Users        *users_service.Service
	Catalogs     *catalogs_service.Service
	Companies    *companies_service.Service
	Files        *files_service.Service
	Cases        *cases_service.Service
	Teams        *teams_service.Service
	Applications *applications_service.Service
}

func Init(appStorage *storage.Storage, objects objectstorage.Storage, jwtConfig config.JWT, objectConfig config.ObjectStorage) *Services {
	userRepo := users_repo.Init(appStorage.Db)
	sessionRepo := session_repo.Init(appStorage.Db)
	catalogRepo := catalog_repo.Init(appStorage.Db)
	companyRepo := company_repo.Init(appStorage.Db)
	fileRepo := file_repo.Init(appStorage.Db)
	caseRepo := case_repo.Init(appStorage.Db)
	teamRepo := team_repo.Init(appStorage.Db)
	applicationRepo := application_repo.Init(appStorage.Db)

	return &Services{
		Auth:         auth_service.Init(sessionRepo, userRepo, jwtConfig),
		Users:        users_service.Init(userRepo),
		Catalogs:     catalogs_service.Init(catalogRepo),
		Companies:    companies_service.Init(companyRepo),
		Files:        files_service.Init(fileRepo, objects, objectConfig.MaxFileSize),
		Cases:        cases_service.Init(caseRepo),
		Teams:        teams_service.Init(teamRepo),
		Applications: applications_service.Init(applicationRepo),
	}
}
