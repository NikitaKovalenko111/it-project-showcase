package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	const origin = "http://localhost:5173"
	handler := CORS([]string{origin})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	request := httptest.NewRequest(http.MethodOptions, "/api/v1/cases", nil)
	request.Header.Set("Origin", origin)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("response status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if actual := recorder.Header().Get("Access-Control-Allow-Origin"); actual != origin {
		t.Fatalf("allowed origin = %q, want %q", actual, origin)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	handler := CORS([]string{"http://localhost:5173"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler was called for a forbidden origin")
	}))

	request := httptest.NewRequest(http.MethodGet, "/api/v1/cases", nil)
	request.Header.Set("Origin", "https://evil.example")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("response status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
}
