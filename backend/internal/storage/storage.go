package storage

import (
	"context"
	"database/sql"
	"fmt"

	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/storage/migrator"
	migrationfiles "it-project-showcase/backend/migrations"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Storage struct {
	Db *sql.DB
}

func Connect(ctx context.Context, cfg config.Postgres) (*Storage, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s search_path=showcase,public",
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

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	if err := migrator.Apply(ctx, db, migrationfiles.Files); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply database migrations: %w", err)
	}

	return &Storage{Db: db}, nil
}
