package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"it-project-showcase/backend/internal/requestcontext"
)

func TestRequestIDPreservesValidHeader(t *testing.T) {
	const expected = "request-12345"

	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if actual := requestcontext.RequestID(r.Context()); actual != expected {
			t.Fatalf("request id in context = %q, want %q", actual, expected)
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(RequestIDHeader, expected)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if actual := recorder.Header().Get(RequestIDHeader); actual != expected {
		t.Fatalf("response request id = %q, want %q", actual, expected)
	}
}

func TestRequestIDReplacesInvalidHeader(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(RequestIDHeader, "bad")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if actual := recorder.Header().Get(RequestIDHeader); !requestIDPattern.MatchString(actual) {
		t.Fatalf("generated request id = %q, want a valid id", actual)
	}
}
