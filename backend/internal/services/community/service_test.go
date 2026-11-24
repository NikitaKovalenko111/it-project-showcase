package community_service

import (
	"context"
	"errors"
	"testing"
)

func TestCreateCommentValidatesInputBeforeRepository(t *testing.T) {
	_, err := Init(nil).CreateComment(context.Background(), "user", "case", "bad-id", "", "text")
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v", err)
	}
}

func TestCreateReportRejectsUnknownReason(t *testing.T) {
	_, err := Init(nil).CreateReport(context.Background(), "user", "case", "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1", "unknown", "")
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v", err)
	}
}
