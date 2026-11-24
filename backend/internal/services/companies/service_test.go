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

func TestCompanyINNValidation(t *testing.T) {
	for _, inn := range []string{"7707083893", "500100732259"} {
		if !validINN(inn) {
			t.Errorf("valid INN rejected: %s", inn)
		}
	}
	for _, inn := range []string{"", "770708389", "77070838930", "7707083894", "500100732249", "500100732258", "0000000000", "000000000000", "770708389x", "７７０７０８３８９３"} {
		if validINN(inn) {
			t.Errorf("invalid INN accepted: %s", inn)
		}
		_, err := Init(nil).Create(context.Background(), "user", models.CompanyInput{FullName: "Company", INN: inn})
		if !errors.Is(err, ErrInvalidInput) {
			t.Errorf("create accepted invalid INN %q: %v", inn, err)
		}
		_, err = Init(nil).Update(context.Background(), "user", "f5f93c16-5426-4f70-8718-e39f29a6e242", models.CompanyInput{FullName: "Company", INN: inn})
		if !errors.Is(err, ErrInvalidInput) {
			t.Errorf("update accepted invalid INN %q: %v", inn, err)
		}
	}
	normalized := normalize(models.CompanyInput{FullName: " Company ", INN: " 7707083893 "})
	if err := validate(normalized); err != nil {
		t.Fatalf("trimmed INN rejected: %v", err)
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
