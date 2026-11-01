package storage

import (
	"database/sql"
	"fmt"
	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/models"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Storage struct {
	Db *sql.DB
}

func Connect(cfg config.Postgres) (*Storage, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.DbHost,
		cfg.DbPort,
		cfg.DbUser,
		cfg.DbPass,
		cfg.DbName,
		cfg.SSLMode,
	)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	storage := &Storage{
		Db: db,
	}

	if err := storage.CreateTables(); err != nil {
		db.Close()
		return nil, fmt.Errorf("initialize tables: %w", err)
	}

	if err := storage.CreateIndexes(); err != nil {
		db.Close()
		return nil, fmt.Errorf("initialize indexes: %w", err)
	}

	return storage, nil
}

func (s *Storage) CreateTables() error {
	tables := []struct {
		name  string
		query string
	}{
		{name: "users", query: models.USERS_TABLE},
		{name: "sessions", query: models.SESSIONS_TABLE},
	}

	tx, err := s.Db.Begin()
	if err != nil {
		return fmt.Errorf("begin create tables transaction: %w", err)
	}
	defer tx.Rollback()

	for _, table := range tables {
		if _, err := tx.Exec(table.query); err != nil {
			return fmt.Errorf("create %s table: %w", table.name, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit create tables transaction: %w", err)
	}

	return nil
}

func (s *Storage) CreateIndexes() error {
	indexes := []struct {
		name  string
		query string
	}{
		{name: "users_username_idx", query: models.USERS_USERNAME_INDEX},
		{name: "users_email_idx", query: models.USERS_EMAIL_INDEX},
		{name: "sessions_refresh_token_hash_idx", query: models.SESSIONS_REFRESH_TOKEN_HASH_INDEX},
		{name: "sessions_user_id_idx", query: models.SESSIONS_USER_ID_INDEX},
		{name: "sessions_expires_at_idx", query: models.SESSIONS_EXPIRES_AT_INDEX},
	}

	tx, err := s.Db.Begin()
	if err != nil {
		return fmt.Errorf("begin create indexes transaction: %w", err)
	}
	defer tx.Rollback()

	for _, index := range indexes {
		if _, err := tx.Exec(index.query); err != nil {
			return fmt.Errorf("create %s index: %w", index.name, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit create indexes transaction: %w", err)
	}

	return nil
}
