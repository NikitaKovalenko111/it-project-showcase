package transport

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/internal/transport/http/handlers"
	auth_handler "it-project-showcase/backend/internal/transport/http/handlers/auth"
	system_handler "it-project-showcase/backend/internal/transport/http/handlers/system"
)

func TestRoutesUseAPIVersionPrefix(t *testing.T) {
	handlerSet := &handlers.Handlers{
		System: system_handler.Init(),
		Auth:   auth_handler.Init(nil),
	}
	mux := http.NewServeMux()
	Init(handlerSet, middleware.Authorization("secret", slog.New(slog.NewTextHandler(io.Discard, nil)))).Start(mux)

	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{name: "versioned health", path: "/api/v1/system/health", wantStatus: http.StatusOK},
		{name: "unversioned health", path: "/system/health", wantStatus: http.StatusNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			recorder := httptest.NewRecorder()
			mux.ServeHTTP(recorder, request)
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, test.wantStatus)
			}
		})
	}
}

func TestLogoutRouteIsProtected(t *testing.T) {
	handlerSet := &handlers.Handlers{
		System: system_handler.Init(),
		Auth:   auth_handler.Init(nil),
	}
	mux := http.NewServeMux()
	Init(handlerSet, middleware.Authorization("secret", slog.New(slog.NewTextHandler(io.Discard, nil)))).Start(mux)

	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestUnknownAPIRouteReturnsJSONError(t *testing.T) {
	handlerSet := &handlers.Handlers{
		System: system_handler.Init(),
		Auth:   auth_handler.Init(nil),
	}
	mux := http.NewServeMux()
	Init(handlerSet, middleware.Authorization("secret", slog.New(slog.NewTextHandler(io.Discard, nil)))).Start(mux)

	request := httptest.NewRequest(http.MethodGet, "/api/v1/unknown", nil)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("content type = %q, want application/json", contentType)
	}

	var response models.ErrorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error.Code != "route_not_found" {
		t.Fatalf("error code = %q, want route_not_found", response.Error.Code)
	}
}
