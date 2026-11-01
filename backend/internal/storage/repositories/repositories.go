package repositories

import (
	"it-project-showcase/backend/internal/storage"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	users_repository "it-project-showcase/backend/internal/storage/repositories/user"
)

type Repositories struct {
	UsersRepo   *users_repository.UsersRepo
	SessionRepo *session_repo.SessionRepo
}

func Init(storage *storage.Storage) *Repositories {
	return &Repositories{
		UsersRepo:   users_repository.Init(storage.Db),
		SessionRepo: session_repo.Init(storage.Db),
	}
}
