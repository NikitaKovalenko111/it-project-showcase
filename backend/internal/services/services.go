package services

import (
	"it-project-showcase/backend/internal/config"
	auth_service "it-project-showcase/backend/internal/services/auth"
	catalogs_service "it-project-showcase/backend/internal/services/catalogs"
	companies_service "it-project-showcase/backend/internal/services/companies"
	users_service "it-project-showcase/backend/internal/services/users"
	"it-project-showcase/backend/internal/storage"
	catalog_repo "it-project-showcase/backend/internal/storage/repositories/catalog"
	company_repo "it-project-showcase/backend/internal/storage/repositories/company"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
)

type Services struct {
	Auth      *auth_service.AuthService
	Users     *users_service.Service
	Catalogs  *catalogs_service.Service
	Companies *companies_service.Service
}

func Init(appStorage *storage.Storage, jwtConfig config.JWT) *Services {
	userRepo := users_repo.Init(appStorage.Db)
	sessionRepo := session_repo.Init(appStorage.Db)
	catalogRepo := catalog_repo.Init(appStorage.Db)
	companyRepo := company_repo.Init(appStorage.Db)

	return &Services{
		Auth:      auth_service.Init(sessionRepo, userRepo, jwtConfig),
		Users:     users_service.Init(userRepo),
		Catalogs:  catalogs_service.Init(catalogRepo),
		Companies: companies_service.Init(companyRepo),
	}
}
