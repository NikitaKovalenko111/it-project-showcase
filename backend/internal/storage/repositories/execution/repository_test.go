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

func TestListStagesAllowsAssignedCurator(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectQuery("student_curators").WithArgs("execution", "curator", false, false).
		WillReturnRows(sqlmock.NewRows([]string{"allowed"}).AddRow(true))
	mock.ExpectQuery("student_curators").WithArgs("execution", "curator", false, false).
		WillReturnRows(sqlmock.NewRows([]string{"stage_id", "ordinal", "title", "expected_result", "due_at", "status", "feedback", "completed_at", "updated_at"}))
	items, err := Init(db).ListStages(context.Background(), "curator", "execution", false, false)
	if err != nil || len(items) != 0 {
		t.Fatalf("items=%v error=%v", items, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
