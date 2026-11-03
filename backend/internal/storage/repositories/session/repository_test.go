package session_repo

import (
	"context"
	"database/sql"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
	"time"
)

func TestRotateRefreshTokenRequiresActiveSession(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectExec("UPDATE auth_sessions").WithArgs("new", sqlmock.AnyArg(), "old").WillReturnResult(sqlmock.NewResult(0, 0))
	err := Init(db).RotateRefreshToken(context.Background(), "old", "new", time.Now().Add(time.Hour))
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
