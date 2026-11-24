package case_repo

import (
	"context"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"

	"it-project-showcase/backend/internal/models"
)

func TestGetPublicPropagatesQueryError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	expected := errors.New("query failed")
	mock.ExpectQuery("SELECT.+FROM cases").WillReturnError(expected)
	_, err := Init(db).GetPublic(context.Background(), "case")
	if !errors.Is(err, expected) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateStageRejectedWhenExecutionExists(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT c.status").WithArgs("case", "user").
		WillReturnRows(sqlmock.NewRows([]string{"status", "allowed"}).AddRow("in_progress", true))
	mock.ExpectQuery("SELECT EXISTS").WithArgs("case").
		WillReturnRows(sqlmock.NewRows([]string{"has_executions"}).AddRow(true))
	mock.ExpectRollback()
	_, err := Init(db).UpdateStage(context.Background(), "user", "case", "stage", models.CaseStageInput{Ordinal: 1, Title: "Stage"})
	if !errors.Is(err, ErrStagesLocked) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
