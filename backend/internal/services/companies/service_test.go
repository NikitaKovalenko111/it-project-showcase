package companies_service

import (
	"context"
	"errors"
	"testing"

	"it-project-showcase/backend/internal/models"
)

func TestCreateValidatesCompanyBeforeRepository(t *testing.T) {
	service := Init(nil)
	_, err := service.Create(context.Background(), "user", models.CompanyInput{FullName: "  ", Website: "javascript:alert(1)"})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("error = %v, want ErrInvalidInput", err)
	}
}

func TestListRejectsMalformedCursor(t *testing.T) {
	service := Init(nil)
	_, err := service.List(context.Background(), 20, "not-a-date", "not-a-uuid")
	if !errors.Is(err, ErrInvalidCursor) {
		t.Fatalf("error = %v, want ErrInvalidCursor", err)
	}
}

func TestModerationUsesCanonicalStatuses(t *testing.T) {
	service := Init(nil)
	_, err := service.Moderate(context.Background(), "admin", "f5f93c16-5426-4f70-8718-e39f29a6e242", "одобрено", "")
	if !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("error = %v, want ErrInvalidStatus", err)
	}
}
