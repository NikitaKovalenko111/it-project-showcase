package opportunity_repo

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

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

func TestAssignSelfCurator(t *testing.T) {
	for _, test := range []struct {
		name    string
		current string
		wantErr error
	}{
		{name: "first assignment"},
		{name: "repeated assignment", current: "curator"},
		{name: "another curator", current: "other", wantErr: ErrCuratorAssigned},
	} {
		t.Run(test.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			assignedAt := time.Now().UTC()
			rows := func() *sqlmock.Rows {
				return sqlmock.NewRows([]string{"student_id", "curator_id", "curator_name", "assigned_by", "assigned_at"})
			}
			mock.ExpectBegin()
			mock.ExpectQuery("FOR NO KEY UPDATE OF s").WithArgs("student").
				WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow("student"))
			mock.ExpectQuery("r.code='university_staff'").WithArgs("curator").
				WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow("curator"))
			existing := rows()
			if test.current != "" {
				existing.AddRow("student", test.current, "Name", test.current, assignedAt)
			}
			mock.ExpectQuery("FOR UPDATE OF sc").WithArgs("student").WillReturnRows(existing)
			if test.current == "" {
				mock.ExpectExec("INSERT INTO showcase.student_curators").WithArgs("student", "curator", "curator").
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectQuery("FROM showcase.student_curators sc").WithArgs("student").
					WillReturnRows(rows().AddRow("student", "curator", "Name", "curator", assignedAt))
			}
			if test.wantErr == nil {
				mock.ExpectCommit()
			} else {
				mock.ExpectRollback()
			}
			item, err := Init(db).AssignSelfCurator(context.Background(), "curator", "student")
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("error = %v, want %v", err, test.wantErr)
			}
			if err == nil && (item.CuratorID != "curator" || item.AssignedBy != "curator" || !item.AssignedAt.Equal(assignedAt)) {
				t.Fatalf("assignment = %+v", item)
			}
			if err = mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
