package services

import (
	"it-project-showcase/backend/internal/config"
	auth_service "it-project-showcase/backend/internal/services/auth"
	"it-project-showcase/backend/internal/storage"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
)

type Services struct {
	Auth *auth_service.AuthService
}

func Init(appStorage *storage.Storage, jwtConfig config.JWT) *Services {
	userRepo := users_repo.Init(appStorage.Db)
	sessionRepo := session_repo.Init(appStorage.Db)

	return &Services{
		Auth: auth_service.Init(sessionRepo, userRepo, jwtConfig),
	}
}
