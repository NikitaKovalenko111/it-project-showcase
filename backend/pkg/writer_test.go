package pkg

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"it-project-showcase/backend/internal/models"
)

func TestWriteErrorUsesEnvelopeAndRequestID(t *testing.T) {
	recorder := httptest.NewRecorder()
	recorder.Header().Set("X-Request-ID", "request-12345")

	WriteError(recorder, http.StatusBadRequest, "invalid_request", "Invalid request")

	var response models.ErrorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error.Code != "invalid_request" {
		t.Fatalf("error code = %q, want invalid_request", response.Error.Code)
	}
	if response.Error.RequestID != "request-12345" {
		t.Fatalf("request id = %q, want request-12345", response.Error.RequestID)
	}
}
