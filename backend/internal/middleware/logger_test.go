package middleware

import (
	"bytes"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLoggerPreservesStreamingAndController(t *testing.T) {
	var output bytes.Buffer
	handler := Logger(slog.New(slog.NewTextHandler(&output, nil)))(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("logger hides http.Flusher")
		}
		_, _ = w.Write([]byte("event: connected\ndata: {}\n\n"))
		flusher.Flush()
		if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(time.Second)); err != nil {
			t.Fatalf("write deadline did not reach underlying writer: %v", err)
		}
	}))
	recorder := &deadlineRecorder{ResponseRecorder: httptest.NewRecorder()}
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/stream", nil))
	if !recorder.Flushed || recorder.deadline.IsZero() {
		t.Fatal("flush or deadline was not forwarded")
	}
	if !strings.Contains(output.String(), "status=200") {
		t.Fatalf("stream status was not logged: %s", output.String())
	}
}

type deadlineRecorder struct {
	*httptest.ResponseRecorder
	deadline time.Time
}

func (w *deadlineRecorder) SetWriteDeadline(deadline time.Time) error {
	w.deadline = deadline
	return nil
}

func TestLoggerWritesRequestFailureAndDetailsInOneRecord(t *testing.T) {
	var output bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&output, nil))
	handler := Logger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !QueueErrorLog(r.Context(), "database operation failed", errors.New("connection refused")) {
			t.Fatal("QueueErrorLog() did not find request error log storage")
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	logs := strings.TrimSpace(output.String())
	if !strings.Contains(logs, "REQUEST FAILED") {
		t.Fatal("logs do not contain REQUEST FAILED")
	}
	if !strings.Contains(logs, "detail=\"database operation failed\"") {
		t.Fatalf("logs do not contain the detailed message:\n%s", logs)
	}
	if !strings.Contains(logs, "error=\"connection refused\"") {
		t.Fatalf("logs do not contain the error:\n%s", logs)
	}
	if strings.Contains(logs, "\n") {
		t.Fatalf("request failure was written as multiple log records:\n%s", logs)
	}
}
