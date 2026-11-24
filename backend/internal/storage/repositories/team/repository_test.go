package team_repo

import (
	"context"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestDeclineInvitationDoesNotReadProtectedTeam(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT team_id,role_id,status FROM team_invitations").WithArgs("invitation", "student").WillReturnRows(sqlmock.NewRows([]string{"team_id", "role_id", "status"}).AddRow("team", nil, "pending"))
	mock.ExpectExec("UPDATE team_invitations SET status").WithArgs("invitation", "declined").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	item, err := Init(db).Respond(context.Background(), "student", "invitation", "declined")
	if err != nil || item != nil {
		t.Fatalf("decline: %+v %v", item, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestGetPropagatesQueryError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	expected := errors.New("query failed")
	mock.ExpectQuery("SELECT.+FROM teams").WithArgs("team", "user", false).WillReturnError(expected)
	_, err := Init(db).Get(context.Background(), "user", "team", false)
	if !errors.Is(err, expected) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
