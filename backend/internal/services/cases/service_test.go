package cases_service

import (
	"context"
	"errors"
	"testing"

	"it-project-showcase/backend/internal/models"
)

func validInput() models.CaseInput {
	return models.CaseInput{
		CompanyID: "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1", Title: "Case", Summary: "Summary", FullBrief: "Brief",
		Type: "educational", Difficulty: "beginner", WorkFormat: "remote", ParticipationMode: "individual",
		AdmissionMode: "open", ResultRequirements: "Result", IPTerms: "Author retains rights", Visibility: "public",
	}
}

func TestCreateRejectsInvalidInputBeforeRepository(t *testing.T) {
	service := Init(nil)
	input := validInput()
	input.TeamSizeMin = intPointer(5)
	input.TeamSizeMax = intPointer(2)
	_, err := service.Create(context.Background(), "user", input)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestCreateRejectsDuplicateReferences(t *testing.T) {
	service := Init(nil)
	input := validInput()
	input.DirectionIDs = []string{"c1d72f58-fb3c-4f52-b384-4f29b462eb9b", "c1d72f58-fb3c-4f52-b384-4f29b462eb9b"}
	_, err := service.Create(context.Background(), "user", input)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestModerationRequiresCommentForRejection(t *testing.T) {
	service := Init(nil)
	_, err := service.Moderate(context.Background(), "admin", "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1", "reject", "")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func intPointer(value int) *int { return &value }
