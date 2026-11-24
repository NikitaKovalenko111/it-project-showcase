package platform_repo

import (
	"context"
	"database/sql"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"testing"
)

func TestReadNotificationReturnsNoRows(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()
	mock.ExpectExec("UPDATE notifications").WithArgs("notification", "user").WillReturnResult(sqlmock.NewResult(0, 0))
	err := Init(db).ReadNotification(context.Background(), "user", "notification")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
