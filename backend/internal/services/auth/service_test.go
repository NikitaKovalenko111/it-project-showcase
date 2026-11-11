package auth_service

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/models"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
	"it-project-showcase/backend/pkg"

	"github.com/DATA-DOG/go-sqlmock"
)

const (
	testUserID        = "f5f93c16-5426-4f70-8718-e39f29a6e242"
	testPassword      = "Password123"
	testAccessSecret  = "test-access-secret"
	testRefreshSecret = "test-refresh-secret"
)

type stringCapture struct{ value string }

func (capture *stringCapture) Match(value driver.Value) bool {
	stringValue, ok := value.(string)
	capture.value = stringValue
	return ok
}

func validRegistration() models.StudentRegistration {
	return models.StudentRegistration{
		Username: "student.one", Email: "student@stud.uust.ru", Password: testPassword,
		LastName: "Иванов", FirstName: "Иван", Institute: "ИРИТ-РТФ",
		Direction: "Программная инженерия", Course: 2, GroupName: "РИ-220901",
		ConsentVersion: "1.0", Technologies: []string{"Go"},
	}
}

func TestStudentRegistrationRequiresUniversityEmail(t *testing.T) {
	input := validRegistration()
	input.Email = "student@gmail.com"
	err := ValidateRegisterRequest(input)
	var invalid *ValidationError
	if !errors.As(err, &invalid) || invalid.Field != "email" || invalid.Code != "student_domain_required" {
		t.Fatalf("validation error = %v", err)
	}
	if err := ValidateStudentProfile(input); err != nil {
		t.Fatalf("existing profile email should remain editable: %v", err)
	}
	input.RequestedRole = "company_representative"
	if err := ValidateRegisterRequest(input); err != nil {
		t.Fatalf("company role request should accept corporate email: %v", err)
	}
}

func TestRegisterUserCreatesProfileRoleAndConsent(t *testing.T) {
	service, mock, closeDB := newTestService(t)
	defer closeDB()
	passwordHash := &stringCapture{}
	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO users").
		WithArgs("student.one", "student@stud.uust.ru", passwordHash).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(testUserID))
	mock.ExpectExec("INSERT INTO students").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO user_roles").WithArgs(testUserID).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO user_consents").WithArgs(testUserID, "1.0").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	userID, err := service.RegisterUser(context.Background(), validRegistration())
	if err != nil {
		t.Fatalf("RegisterUser() error = %v", err)
	}
	if userID != testUserID {
		t.Fatalf("userID = %q", userID)
	}
	if passwordHash.value == testPassword || !VerifyPassword(testPassword, passwordHash.value) {
		t.Fatal("password was not hashed correctly")
	}
	assertSQLExpectations(t, mock)
}

func TestRegisterUserValidationDoesNotWrite(t *testing.T) {
	service, mock, closeDB := newTestService(t)
	defer closeDB()
	input := validRegistration()
	input.ConsentVersion = ""
	_, err := service.RegisterUser(context.Background(), input)
	var validationErr *ValidationError
	if !errors.As(err, &validationErr) || validationErr.Field != "consent_version" {
		t.Fatalf("error = %v, want consent validation error", err)
	}
	assertSQLExpectations(t, mock)
}

func TestLoginUserIssuesRoleClaimsAndSession(t *testing.T) {
	service, mock, closeDB := newTestService(t)
	defer closeDB()
	hash, _ := HashPassword(testPassword)
	mock.ExpectQuery("SELECT user_id, username, email, password_hash, status").WithArgs("student.one").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username", "email", "password_hash", "status", "failed_login_count", "locked_until"}).
			AddRow(testUserID, "student.one", "student@example.com", hash, "active", 0, nil))
	mock.ExpectQuery("SELECT r.code").WithArgs(testUserID).
		WillReturnRows(sqlmock.NewRows([]string{"code"}).AddRow("student"))
	mock.ExpectExec("UPDATE users").WithArgs(testUserID).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO auth_sessions").WithArgs(testUserID, sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))

	_, accessToken, refreshToken, err := service.LoginUser(context.Background(), "Student.One", testPassword)
	if err != nil {
		t.Fatalf("LoginUser() error = %v", err)
	}
	claims, err := pkg.ValidateAccessToken(accessToken, testAccessSecret)
	if err != nil {
		t.Fatal(err)
	}
	if len(claims.Roles) != 1 || claims.Roles[0] != "student" {
		t.Fatalf("roles = %v", claims.Roles)
	}
	if _, err := pkg.ValidateRefreshToken(refreshToken, testRefreshSecret); err != nil {
		t.Fatal(err)
	}
	assertSQLExpectations(t, mock)
}

func TestLoginUserRecordsFailedAttempt(t *testing.T) {
	service, mock, closeDB := newTestService(t)
	defer closeDB()
	hash, _ := HashPassword(testPassword)
	mock.ExpectQuery("SELECT user_id, username, email, password_hash, status").WithArgs("student.one").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username", "email", "password_hash", "status", "failed_login_count", "locked_until"}).
			AddRow(testUserID, "student.one", "student@example.com", hash, "active", 0, nil))
	mock.ExpectExec("UPDATE users").WithArgs(testUserID, 5, sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
	_, _, _, err := service.LoginUser(context.Background(), "student.one", "WrongPassword123")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("error = %v", err)
	}
	assertSQLExpectations(t, mock)
}

func TestLoginUserRejectsLockedAccount(t *testing.T) {
	service, mock, closeDB := newTestService(t)
	defer closeDB()
	lockedUntil := time.Now().Add(time.Minute)
	mock.ExpectQuery("SELECT user_id, username, email, password_hash, status").WithArgs("student.one").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username", "email", "password_hash", "status", "failed_login_count", "locked_until"}).
			AddRow(testUserID, "student.one", "student@example.com", "hash", "active", 5, lockedUntil))
	_, _, _, err := service.LoginUser(context.Background(), "student.one", testPassword)
	if !errors.Is(err, ErrAccountLocked) {
		t.Fatalf("error = %v", err)
	}
	assertSQLExpectations(t, mock)
}

func newTestService(t *testing.T) (*AuthService, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	service := Init(session_repo.Init(db), users_repo.Init(db), config.JWT{
		AccessSecret: testAccessSecret, RefreshSecret: testRefreshSecret,
		AccessTokenTTL: "15m", RefreshTokenTTL: "24h",
	})
	return service, mock, func() { db.Close() }
}

func assertSQLExpectations(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
