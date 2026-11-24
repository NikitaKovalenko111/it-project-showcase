package application_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateRequiresStudentClaims(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init(nil).Create(recorder, httptest.NewRequest(http.MethodPost, "/applications", strings.NewReader(`{}`)))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d", recorder.Code)
	}
}
