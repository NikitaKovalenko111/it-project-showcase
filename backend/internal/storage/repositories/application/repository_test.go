package application_repo

import (
	"context"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestGetPropagatesQueryError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	expected := errors.New("query failed")
	mock.ExpectQuery("SELECT.+FROM applications").WithArgs("application", "user", false, false).WillReturnError(expected)
	_, err := Init(db).Get(context.Background(), "user", "application", false, false)
	if !errors.Is(err, expected) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
