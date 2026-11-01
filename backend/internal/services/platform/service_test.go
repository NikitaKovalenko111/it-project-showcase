package platform_service

import (
	"bytes"
	"it-project-showcase/backend/internal/models"
	"testing"
	"time"
)

func rows() []models.ExportRow {
	return []models.ExportRow{{ID: "id", Title: "Русский проект", Status: "published", Owner: "Иван", CreatedAt: time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)}}
}
func TestCSVExport(t *testing.T) {
	b, e := csvBytes(rows())
	if e != nil {
		t.Fatal(e)
	}
	if !bytes.Contains(b, []byte("Русский проект")) {
		t.Fatal("CSV lost UTF-8 text")
	}
}
func TestXLSXExport(t *testing.T) {
	b, e := xlsxBytes(rows())
	if e != nil {
		t.Fatal(e)
	}
	if len(b) < 100 || !bytes.HasPrefix(b, []byte("PK")) {
		t.Fatal("invalid xlsx")
	}
}
func TestPDFExport(t *testing.T) {
	b, e := pdfBytes(rows(), "projects")
	if e != nil {
		t.Fatal(e)
	}
	if !bytes.HasPrefix(b, []byte("%PDF")) {
		t.Fatal("invalid pdf")
	}
}
func TestInvalidFavorite(t *testing.T) {
	s := &Service{}
	if e := s.SetFavorite(nil, "u", "bad", "bad", true); e != ErrInvalid {
		t.Fatalf("expected invalid, got %v", e)
	}
}

func TestInvalidSSELastEventID(t *testing.T) {
	s := &Service{}
	_, _, err := s.NotificationStreamStart(nil, "u", "bad")
	if err != ErrInvalid {
		t.Fatalf("expected invalid, got %v", err)
	}
}
