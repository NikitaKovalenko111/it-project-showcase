package system_handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthReturnsEmptyOK(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init().Health(recorder, httptest.NewRequest(http.MethodGet, "/system/health", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("body = %q", recorder.Body.String())
	}
}
