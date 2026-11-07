package auth_handler

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	auth_service "it-project-showcase/backend/internal/services/auth"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestRegisterReturnsConflictForExistingUsernameOrEmail(t *testing.T) {
	tests := []struct {
		name            string
		constraintName  string
		expectedCode    string
		expectedMessage string
	}{
		{
			name:            "username already exists",
			constraintName:  "users_username_idx",
			expectedCode:    "username_taken",
			expectedMessage: "Username is already in use",
		},
		{
			name:            "email already exists",
			constraintName:  "users_email_idx",
			expectedCode:    "email_taken",
			expectedMessage: "Email is already in use",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock.New() error = %v", err)
			}
			defer func() {
				mock.ExpectClose()
				if err := db.Close(); err != nil {
					t.Errorf("db.Close() error = %v", err)
				}
			}()

			mock.ExpectBegin()
			mock.ExpectQuery("INSERT INTO users").
				WithArgs("student.one", "student@example.com", sqlmock.AnyArg()).
				WillReturnError(&pgconn.PgError{
					Code:           "23505",
					ConstraintName: test.constraintName,
				})
			mock.ExpectRollback()

			service := auth_service.Init(
				session_repo.Init(db),
				users_repo.Init(db),
				config.JWT{},
			)
			handler := Init(service)

			requestBody := strings.NewReader(`{
				"username":"student.one",
				"email":"student@example.com",
				"password":"Password123",
				"last_name":"Иванов",
				"first_name":"Иван",
				"institute":"ИРИТ-РТФ",
				"direction":"Программная инженерия",
				"course":2,
				"group_name":"РИ-220901",
				"consent_version":"1.0"
			}`)
			request := httptest.NewRequest(http.MethodPost, "/auth/register", requestBody)
			recorder := httptest.NewRecorder()

			var logOutput bytes.Buffer
			logger := slog.New(slog.NewTextHandler(&logOutput, nil))
			middleware.Logger(logger)(http.HandlerFunc(handler.Register)).ServeHTTP(recorder, request)

			if recorder.Code != http.StatusConflict {
				t.Fatalf("response status = %d, want %d", recorder.Code, http.StatusConflict)
			}

			var response models.ErrorResponse
			if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if response.Error.Code != test.expectedCode {
				t.Fatalf("response error = %q, want %q", response.Error.Code, test.expectedCode)
			}
			if response.Error.Message != test.expectedMessage {
				t.Fatalf("response message = %q, want %q", response.Error.Message, test.expectedMessage)
			}

			logs := logOutput.String()
			if !strings.Contains(logs, "level=WARN") || !strings.Contains(logs, "status=409") {
				t.Fatalf("conflict was not logged as WARN:\n%s", logs)
			}
			if strings.Contains(logs, "SQLSTATE") || strings.Contains(logs, test.constraintName) {
				t.Fatalf("database details leaked into the request log:\n%s", logs)
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet SQL expectations: %v", err)
			}
		})
	}
}
