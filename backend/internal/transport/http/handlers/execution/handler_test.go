package execution_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUpdateStageRejectsMalformedJSON(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init(nil).UpdateStage(recorder, httptest.NewRequest(http.MethodPatch, "/executions/e/stages/s", strings.NewReader(`{`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
