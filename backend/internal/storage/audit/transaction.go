package audit

import (
	"context"
	"database/sql"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/pkg"
)

// Begin records the request identity on the connection for this transaction.
func Begin(ctx context.Context, db *sql.DB) (*sql.Tx, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	if actor, ok := middleware.UserIDFromContext(ctx); ok {
		if _, err = tx.ExecContext(ctx, `SELECT set_config('showcase.audit_actor', $1, true), set_config('showcase.audit_request', $2, true)`, actor, pkg.RequestID(ctx)); err != nil {
			_ = tx.Rollback()
			return nil, err
		}
	}
	return tx, nil
}

func Exec(ctx context.Context, db *sql.DB, query string, args ...any) (sql.Result, error) {
	tx, err := Begin(ctx, db)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit()
}
