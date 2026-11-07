package result_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateEvaluationRejectsMalformedJSON(t *testing.T) {
	mux := http.NewServeMux()
	Init(nil).StartSubmissions(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/submission/evaluations", strings.NewReader(`{`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
