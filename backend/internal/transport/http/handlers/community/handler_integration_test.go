package community_handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	community_service "it-project-showcase/backend/internal/services/community"
	community_repo "it-project-showcase/backend/internal/storage/repositories/community"
)

func TestListCaseCommentsThroughHandlerServiceAndRepository(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	caseID := "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1"
	commentID := "6c76ce4e-b384-4f29-b462-eb9b8d5e8ba2"
	authorID := "7c76ce4e-b384-4f29-b462-eb9b8d5e8ba3"
	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{"comment_id", "resource_type", "resource_id", "parent_comment_id", "author_id", "author_name", "body", "status", "reply_count", "created_at", "updated_at", "deleted_at"}).
		AddRow(commentID, "case", caseID, nil, authorID, "Test Student", "Hello", "active", 2, now, now, nil)
	mock.ExpectQuery(`(?s)SELECT c\.comment_id.*FROM showcase\.comments c.*ORDER BY c\.created_at DESC,c\.comment_id DESC`).
		WithArgs("case", caseID, nil, 20, 0).WillReturnRows(rows)
	mock.ExpectQuery(`SELECT count\(\*\) FROM showcase\.comments`).WithArgs("case", caseID, nil).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	handler := Init(community_service.Init(community_repo.Init(db)))
	request := httptest.NewRequest(http.MethodGet, "/cases/"+caseID+"/comments", nil)
	request.SetPathValue("case_id", caseID)
	recorder := httptest.NewRecorder()
	handler.ListCaseComments(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
