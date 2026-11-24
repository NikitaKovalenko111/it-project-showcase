package users_repo

import (
	"context"
	"database/sql"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"it-project-showcase/backend/internal/models"
	"testing"
)

func TestRegisterRepresentativeStoresNamesWithoutGrantingRole(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO users").WithArgs("rep", "rep@example.test", "hash", "Петров Пётр Петрович").WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow("user"))
	mock.ExpectExec("INSERT INTO user_consents").WithArgs("user", "1").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO role_requests").WithArgs("user", "company_representative").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	id, err := Init(db).RegisterRoleApplicant(context.Background(), models.StudentRegistration{Username: "rep", Email: "rep@example.test", FullName: "Петров Пётр Петрович", ConsentVersion: "1", RequestedRole: "company_representative"}, "hash")
	if err != nil || id != "user" {
		t.Fatalf("registration: %s %v", id, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRepresentativeProfilePatchKeepsOmittedField(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	topics := "Go и SQL"
	mock.ExpectBegin()
	mock.ExpectQuery("UPDATE showcase.users SET experience_and_interests=COALESCE").WithArgs("user", nil, topics).WillReturnRows(sqlmock.NewRows([]string{"user_id", "experience_and_interests", "help_topics"}).AddRow("user", "Existing experience", topics))
	mock.ExpectCommit()
	p, err := Init(db).UpdateRepresentativeProfile(context.Background(), "user", models.RepresentativeProfilePatch{HelpTopics: &topics})
	if err != nil || p.ExperienceAndInterests != "Existing experience" || p.HelpTopics != topics {
		t.Fatalf("profile: %+v %v", p, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestSetUserStatusRequiresExistingUser(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE users").WithArgs("user", "blocked").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()
	err := Init(db).SetUserStatus(context.Background(), "user", "blocked", "")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
