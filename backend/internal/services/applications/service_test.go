package applications_service

import (
	"context"
	"errors"
	"it-project-showcase/backend/internal/models"
	"testing"
)

func TestCreateRejectsTeamWithoutTeamID(t *testing.T) {
	_, err := Init(nil).Create(context.Background(), "user", models.ApplicationInput{CaseID: "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1", ApplicantType: "team"})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
func TestStatusRejectsStudentAcceptance(t *testing.T) {
	_, err := Init(nil).SetStatus(context.Background(), "user", "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1", "accepted", "", false)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
