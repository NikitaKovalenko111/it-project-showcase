package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTimeoutAddsDeadlineAndCancelsContext(t *testing.T) {
	var requestContext context.Context
	handler := Timeout(time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestContext = r.Context()
		if _, ok := requestContext.Deadline(); !ok {
			t.Fatal("request context has no deadline")
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("response status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	select {
	case <-requestContext.Done():
	default:
		t.Fatal("request context was not canceled after handler completed")
	}
}

func TestTimeoutExceptLeavesStreamWithoutDeadline(t *testing.T) {
	handler := TimeoutExcept(time.Second, "/api/v1/notifications/stream")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Context().Deadline(); ok {
			t.Fatal("stream context must not have a request deadline")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/stream", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d", recorder.Code)
	}
}
