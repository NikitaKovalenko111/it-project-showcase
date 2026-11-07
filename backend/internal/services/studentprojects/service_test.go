package studentprojects_service

import (
	"context"
	"errors"
	"it-project-showcase/backend/internal/models"
	"testing"
)

func TestProjectValidation(t *testing.T) {
	s := &Service{}
	cases := []models.StudentProjectInput{{Category: "other", Title: "", ShortDescription: "x", FullDescription: "x"}, {Category: "bad", Title: "x", ShortDescription: "x", FullDescription: "x"}, {Category: "other", Title: "x", ShortDescription: "x", FullDescription: "x", DirectionIDs: []string{"bad"}}}
	for _, in := range cases {
		_, err := s.Create(context.Background(), "u", in)
		if !errors.Is(err, ErrInvalid) {
			t.Fatalf("expected invalid, got %v", err)
		}
	}
}
func TestModerationValidation(t *testing.T) {
	s := &Service{}
	_, err := s.Moderate(context.Background(), "u", "bad", "approved", "")
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected invalid, got %v", err)
	}
}
