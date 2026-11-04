package opportunity_repo

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRatingReadsServerView(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT quality_score,completion_score,project_score,achievement_score,quality_score+completion_score+project_score+achievement_score FROM showcase.student_ratings WHERE student_id=$1")).
		WithArgs("student").WillReturnRows(sqlmock.NewRows([]string{"quality", "completion", "projects", "achievements", "rating"}).AddRow(50.0, 10.0, 8.0, 5.0, 73.0))
	rating, err := Init(db).Rating(context.Background(), "student")
	if err != nil {
		t.Fatal(err)
	}
	if rating.Rating != 73 || rating.QualityScore != 50 {
		t.Fatalf("rating = %+v", rating)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestSetPlacementsRequiresEveryExecutionToBeEvaluated(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM showcase\.cases`).WithArgs("case", "manager").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM showcase\.executions`).WithArgs("case").
		WillReturnRows(sqlmock.NewRows([]string{"ready"}).AddRow(false))
	mock.ExpectRollback()
	err = Init(db).SetPlacements(context.Background(), "manager", "case", nil)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("error = %v, want ErrConflict", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
