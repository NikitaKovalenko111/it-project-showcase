package users_repo

import (
	"context"
	"database/sql"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestSetUserStatusRequiresExistingUser(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE users").WithArgs("user", "blocked").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()
	err := Init(db).SetUserStatus(context.Background(), "user", "blocked")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
