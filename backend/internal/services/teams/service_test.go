package teams_service

import (
	"context"
	"errors"
	"testing"
)

func TestCreateRejectsBlankName(t *testing.T) {
	_, err := Init(nil).Create(context.Background(), "user", "  ")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
func TestInviteRejectsSelfInvitation(t *testing.T) {
	id := "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1"
	_, err := Init(nil).Invite(context.Background(), id, "4bdb38e2-feca-4dd8-9489-cd6648851f44", id, "")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
