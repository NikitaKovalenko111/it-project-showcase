package company_repo

import (
	"context"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestInviteMemberRequiresApprovedRepresentative(t *testing.T) {
	for _, state := range []struct {
		name             string
		active, approved bool
	}{{"student", true, false}, {"pending", true, false}, {"blocked", false, true}} {
		t.Run(state.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			mock.ExpectBegin()
			mock.ExpectQuery("SELECT status='active' FROM users").WithArgs("target").WillReturnRows(sqlmock.NewRows([]string{"active"}).AddRow(state.active))
			mock.ExpectQuery("SELECT EXISTS.+user_roles").WithArgs("target").WillReturnRows(sqlmock.NewRows([]string{"approved"}).AddRow(state.approved))
			mock.ExpectRollback()
			_, err = Init(db).InviteMember(context.Background(), "sender", "company", "target", "Developer")
			if !errors.Is(err, ErrRepresentativeApprovalRequired) {
				t.Fatalf("error = %v", err)
			}
			if err = mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestAcceptInvitationRollsBackWhenApprovalRevoked(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT company_id.+FROM company_member_invitations").WithArgs("invitation", "user").WillReturnRows(
		sqlmock.NewRows([]string{"company_id", "position", "permissions", "status"}).AddRow("company", "Developer", []byte(`["manage_company"]`), "pending"))
	mock.ExpectQuery("SELECT status='active' FROM users").WithArgs("user").WillReturnRows(sqlmock.NewRows([]string{"active"}).AddRow(true))
	mock.ExpectQuery("SELECT EXISTS.+user_roles").WithArgs("user").WillReturnRows(sqlmock.NewRows([]string{"approved"}).AddRow(false))
	mock.ExpectRollback()
	_, err = Init(db).RespondMemberInvitation(context.Background(), "user", "invitation", "accepted")
	if !errors.Is(err, ErrRepresentativeApprovalRequired) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestGetByIDPropagatesQueryError(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	expected := errors.New("query failed")
	mock.ExpectQuery("SELECT.+FROM companies").WithArgs("company").WillReturnError(expected)
	_, err := Init(db).GetByID(context.Background(), "company")
	if !errors.Is(err, expected) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
