package catalog_repo

import (
	"context"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestListRejectsUnsupportedCatalogWithoutQuery(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	if _, err := Init(db).List(context.Background(), "unknown"); err == nil {
		t.Fatal("expected error")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
