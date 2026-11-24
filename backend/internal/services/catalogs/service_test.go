package catalogs_service

import (
	"context"
	"errors"
	"testing"
)

func TestUnsupportedCatalogIsRejectedBeforeRepository(t *testing.T) {
	service := Init(nil)
	_, err := service.List(context.Background(), "roles")
	if !errors.Is(err, ErrUnsupportedCatalog) {
		t.Fatalf("error = %v, want ErrUnsupportedCatalog", err)
	}
}

func TestEmptyCatalogItemIsRejectedBeforeRepository(t *testing.T) {
	service := Init(nil)
	_, err := service.Create(context.Background(), "directions", "  ", "")
	if !errors.Is(err, ErrInvalidItem) {
		t.Fatalf("error = %v, want ErrInvalidItem", err)
	}
}
