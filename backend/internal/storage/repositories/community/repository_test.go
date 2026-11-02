package community_repo

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestCreateReportReturnsConflictForExistingOpenReport(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery(regexp.QuoteMeta("INSERT INTO showcase.reports(reporter_id,resource_type,resource_id,reason,details) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reporter_id,resource_type,resource_id) WHERE status IN ('open','reviewing') DO NOTHING RETURNING report_id")).
		WithArgs("user", "case", "case-id", "spam", "").WillReturnRows(sqlmock.NewRows([]string{"report_id"}))
	_, err = Init(db).CreateReport(context.Background(), "user", "case", "case-id", "spam", "")
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("error = %v, want ErrConflict", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteCommentIsSoftDelete(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectExec("UPDATE showcase.comments SET status='deleted'").WithArgs("comment", "author", false).WillReturnResult(sqlmock.NewResult(0, 1))
	if err = Init(db).DeleteComment(context.Background(), "author", "comment", false); err != nil {
		t.Fatal(err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
