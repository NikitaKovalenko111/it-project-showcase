package results_service

import (
	"context"
	"errors"
	"it-project-showcase/backend/internal/models"
	"testing"
)

func TestCreateSubmissionValidation(t *testing.T) {
	s := &Service{}
	tests := []models.SubmissionInput{{Kind: "final", Title: "", Description: "x"}, {Kind: "unknown", Title: "x", Description: "x"}, {Kind: "stage", Title: "x", Description: "x", StageID: "bad"}}
	for _, in := range tests {
		_, err := s.CreateSubmission(context.Background(), "u", "bad", in)
		if !errors.Is(err, ErrInvalid) {
			t.Fatalf("expected invalid, got %v", err)
		}
	}
}
func TestCreateEvaluationValidation(t *testing.T) {
	s := &Service{}
	_, err := s.CreateEvaluation(context.Background(), "u", "bad", models.EvaluationInput{})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected invalid, got %v", err)
	}
}
func TestAwardValidation(t *testing.T) {
	s := &Service{}
	n := -1.0
	_, err := s.CreateAward(context.Background(), "u", "bad", "", nil, &n, nil)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected invalid, got %v", err)
	}
}
