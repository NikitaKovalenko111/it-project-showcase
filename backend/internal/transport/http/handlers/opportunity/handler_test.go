package opportunity_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	opportunities_service "it-project-showcase/backend/internal/services/opportunities"
)

func TestSetCaseCoverValidatesIDsBeforeRepository(t *testing.T) {
	handler := Init(opportunities_service.Init(nil))
	request := httptest.NewRequest(http.MethodPut, "/cases/bad/cover", strings.NewReader(`{"file_id":"bad"}`))
	request.SetPathValue("case_id", "bad")
	recorder := httptest.NewRecorder()
	handler.SetCaseCover(recorder, request)
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", recorder.Code)
	}
}
