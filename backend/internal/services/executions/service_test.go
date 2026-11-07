package executions_service

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestUpdateStageRejectsActorTransitions(t *testing.T) {
	service := Init(nil)
	id := "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1"
	tests := []struct {
		name, status string
		company      bool
	}{
		{name: "student cannot accept", status: "accepted", company: false},
		{name: "company cannot submit", status: "submitted", company: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := service.UpdateStage(context.Background(), id, id, id, test.status, "", test.company)
			if !errors.Is(err, ErrTransition) {
				t.Fatalf("expected transition error, got %v", err)
			}
		})
	}
}

func TestAddCommentRejectsBlankAndLongBody(t *testing.T) {
	service := Init(nil)
	id := "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1"
	for _, body := range []string{"   ", strings.Repeat("a", 5001)} {
		_, err := service.AddComment(context.Background(), id, id, "", body, false, false)
		if !errors.Is(err, ErrInvalid) {
			t.Fatalf("expected invalid input, got %v", err)
		}
	}
}

func TestUpdateNDARejectsUnknownStatus(t *testing.T) {
	service := Init(nil)
	id := "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1"
	_, err := service.UpdateNDA(context.Background(), id, id, "pending", "")
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
