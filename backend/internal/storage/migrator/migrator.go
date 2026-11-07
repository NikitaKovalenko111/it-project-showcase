package migrator

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const advisoryLockID int64 = 491947530156966123

type migration struct {
	version  int64
	name     string
	query    string
	checksum string
}

type appliedMigration struct {
	name     string
	checksum string
}

func Apply(ctx context.Context, db *sql.DB, migrationFS fs.FS) error {
	migrations, err := discover(migrationFS)
	if err != nil {
		return err
	}

	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", advisoryLockID); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", advisoryLockID)

	if err := ensureMetadata(ctx, conn); err != nil {
		return err
	}

	applied, err := loadApplied(ctx, conn)
	if err != nil {
		return err
	}

	for _, item := range migrations {
		if previous, ok := applied[item.version]; ok {
			if previous.name != item.name || previous.checksum != item.checksum {
				return fmt.Errorf("migration %d was changed after it was applied", item.version)
			}
			continue
		}

		if err := applyOne(ctx, conn, item); err != nil {
			return err
		}
	}

	return nil
}

func discover(migrationFS fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(migrationFS, ".")
	if err != nil {
		return nil, fmt.Errorf("read migrations: %w", err)
	}

	result := make([]migration, 0, len(entries))
	versions := make(map[int64]string)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}

		versionText, _, ok := strings.Cut(entry.Name(), "_")
		if !ok {
			return nil, fmt.Errorf("invalid migration name %q", entry.Name())
		}
		version, err := strconv.ParseInt(versionText, 10, 64)
		if err != nil || version <= 0 {
			return nil, fmt.Errorf("invalid migration version in %q", entry.Name())
		}
		if previous, exists := versions[version]; exists {
			return nil, fmt.Errorf("duplicate migration version %d: %s and %s", version, previous, entry.Name())
		}

		data, err := fs.ReadFile(migrationFS, filepath.ToSlash(entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		query := normalizeSQL(data)
		hash := sha256.Sum256([]byte(query))
		versions[version] = entry.Name()
		result = append(result, migration{
			version:  version,
			name:     entry.Name(),
			query:    query,
			checksum: hex.EncodeToString(hash[:]),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].version < result[j].version
	})

	return result, nil
}

func normalizeSQL(data []byte) string {
	return strings.ReplaceAll(string(data), "\r\n", "\n")
}

func ensureMetadata(ctx context.Context, conn *sql.Conn) error {
	_, err := conn.ExecContext(ctx, `
		CREATE SCHEMA IF NOT EXISTS showcase;
		CREATE TABLE IF NOT EXISTS showcase.schema_migrations (
			version BIGINT PRIMARY KEY,
			name TEXT NOT NULL,
			checksum CHAR(64) NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		return fmt.Errorf("initialize migration metadata: %w", err)
	}

	return nil
}

func loadApplied(ctx context.Context, conn *sql.Conn) (map[int64]appliedMigration, error) {
	rows, err := conn.QueryContext(ctx, `
		SELECT version, name, checksum
		FROM showcase.schema_migrations
		ORDER BY version
	`)
	if err != nil {
		return nil, fmt.Errorf("load applied migrations: %w", err)
	}
	defer rows.Close()

	result := make(map[int64]appliedMigration)
	for rows.Next() {
		var version int64
		var item appliedMigration
		if err := rows.Scan(&version, &item.name, &item.checksum); err != nil {
			return nil, fmt.Errorf("scan applied migration: %w", err)
		}
		result[version] = item
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate applied migrations: %w", err)
	}

	return result, nil
}

func applyOne(ctx context.Context, conn *sql.Conn, item migration) error {
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration %s: %w", item.name, err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, item.query); err != nil {
		return fmt.Errorf("apply migration %s: %w", item.name, err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO showcase.schema_migrations (version, name, checksum)
		VALUES ($1, $2, $3)
	`, item.version, item.name, item.checksum); err != nil {
		return fmt.Errorf("record migration %s: %w", item.name, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration %s: %w", item.name, err)
	}

	return nil
}
