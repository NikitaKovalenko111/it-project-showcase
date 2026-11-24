package file_handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	files_service "it-project-showcase/backend/internal/services/files"
)

func TestUploadRequiresMultipart(t *testing.T) {
	recorder := httptest.NewRecorder()
	service := files_service.Init(nil, nil, 1024)
	Init(service).Upload(recorder, httptest.NewRequest(http.MethodPost, "/files", strings.NewReader("not multipart")))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
