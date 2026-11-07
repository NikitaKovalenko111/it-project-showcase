package users_service

import (
	"context"
	"errors"
	"testing"
)

func TestSetStatusRejectsUnknownStatusBeforeRepository(t *testing.T) {
	err := Init(nil).SetStatus(context.Background(), "user", "unknown")
	if !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("error = %v", err)
	}
}
