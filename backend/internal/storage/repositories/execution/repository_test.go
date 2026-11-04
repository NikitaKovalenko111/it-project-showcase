package execution_repo

import (
	"context"
	"database/sql"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestListStagesDeniesUnknownExecution(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectQuery("SELECT.+FROM executions").WithArgs("execution", "user", false, false).WillReturnError(sql.ErrNoRows)
	_, err := Init(db).ListStages(context.Background(), "user", "execution", false, false)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
