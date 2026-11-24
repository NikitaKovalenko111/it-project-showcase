package studentproject_repo

import (
	"context"
	"database/sql"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestLikeRequiresPublishedProject(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectQuery("SELECT EXISTS").WithArgs("project").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	_, err := Init(db).Like(context.Background(), "user", "project", true)
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
