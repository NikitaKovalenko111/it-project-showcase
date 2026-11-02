package community_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	community_service "it-project-showcase/backend/internal/services/community"
)

func TestListCaseCommentsRejectsUnknownSort(t *testing.T) {
	handler := Init(community_service.Init(nil))
	request := httptest.NewRequest(http.MethodGet, "/cases/5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1/comments?sort=random", nil)
	request.SetPathValue("case_id", "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1")
	recorder := httptest.NewRecorder()
	handler.ListCaseComments(recorder, request)
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "validation_failed") {
		t.Fatalf("body = %s", recorder.Body.String())
	}
}

func TestCreateReportRejectsUnknownReason(t *testing.T) {
	handler := Init(community_service.Init(nil))
	request := httptest.NewRequest(http.MethodPost, "/reports", strings.NewReader(`{"resource_type":"case","resource_id":"5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1","reason":"unknown"}`))
	recorder := httptest.NewRecorder()
	handler.CreateReport(recorder, request)
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", recorder.Code)
	}
}
