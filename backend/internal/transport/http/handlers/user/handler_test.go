package user_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSetStatusRejectsMalformedJSON(t *testing.T) {
	request := httptest.NewRequest(http.MethodPatch, "/users/u/status", strings.NewReader(`{`))
	request.SetPathValue("user_id", "u")
	recorder := httptest.NewRecorder()
	Init(nil).SetStatus(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
