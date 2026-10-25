package repositories

import (
	"kanban-board/internal/storage"
	session_repo "kanban-board/internal/storage/repositories/session"
	users_repository "kanban-board/internal/storage/repositories/user"
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
