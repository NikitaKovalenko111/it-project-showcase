package result_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateEvaluationRejectsMalformedJSON(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init(nil).createEvaluation(recorder, httptest.NewRequest(http.MethodPost, "/submission/evaluations", strings.NewReader(`{`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
