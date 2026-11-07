package file_repo

import (
	"context"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestGetAccessiblePropagatesQueryError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	expected := errors.New("query failed")
	mock.ExpectQuery("SELECT.+FROM files").WithArgs("file", "user", false).WillReturnError(expected)
	_, err := Init(db).GetAccessible(context.Background(), "file", "user", false)
	if !errors.Is(err, expected) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
