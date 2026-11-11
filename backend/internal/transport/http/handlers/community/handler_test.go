package community_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	community_service "it-project-showcase/backend/internal/services/community"
	community_repo "it-project-showcase/backend/internal/storage/repositories/community"
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

func TestListCaseCommentsThroughHandlerServiceAndRepository(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	caseID := "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1"
	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{"comment_id", "resource_type", "resource_id", "parent_comment_id", "author_id", "author_name", "author_photo_file_id", "body", "status", "reply_count", "likes_count", "liked_by_me", "created_at", "updated_at", "deleted_at"}).
		AddRow("6c76ce4e-b384-4f29-b462-eb9b8d5e8ba2", "case", caseID, nil, "7c76ce4e-b384-4f29-b462-eb9b8d5e8ba3", "Test Student", nil, "Hello", "active", 2, 3, false, now, now, nil)
	mock.ExpectQuery(`(?s)SELECT c\.comment_id.*FROM showcase\.comments c.*ORDER BY c\.created_at DESC,c\.comment_id DESC`).
		WithArgs("", "case", caseID, nil, 20, 0).WillReturnRows(rows)
	mock.ExpectQuery(`SELECT count\(\*\) FROM showcase\.comments`).WithArgs("case", caseID, nil).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	handler := Init(community_service.Init(community_repo.Init(db)))
	request := httptest.NewRequest(http.MethodGet, "/cases/"+caseID+"/comments", nil)
	request.SetPathValue("case_id", caseID)
	recorder := httptest.NewRecorder()
	handler.ListCaseComments(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"likes_count":3`) || !strings.Contains(recorder.Body.String(), `"liked_by_me":false`) {
		t.Fatalf("missing like state: %s", recorder.Body.String())
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
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
