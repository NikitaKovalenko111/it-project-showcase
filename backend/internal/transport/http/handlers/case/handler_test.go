package case_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateRejectsMalformedJSON(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init(nil).Create(recorder, httptest.NewRequest(http.MethodPost, "/cases", strings.NewReader(`{`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}

func TestUpdateStageRejectsMalformedJSON(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init(nil).UpdateStage(recorder, httptest.NewRequest(http.MethodPatch, "/cases/c/stages/s", strings.NewReader(`{`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
