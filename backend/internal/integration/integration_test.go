//go:build integration

package integration

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func testDatabase(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err = db.PingContext(context.Background()); err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	return db
}

func TestSprint4DatabaseInvariants(t *testing.T) {
	db := testDatabase(t)
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	if _, err = tx.ExecContext(ctx, `SET LOCAL search_path=showcase,public`); err != nil {
		t.Fatal(err)
	}

	suffix := uuid.NewString()
	var userID string
	err = tx.QueryRowContext(ctx, `INSERT INTO users(username,email,group_name,password_hash) VALUES($1,$2,'test','hash') RETURNING user_id`, "test-"+suffix[:8], suffix+"@example.test").Scan(&userID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO students(user_id,last_name,first_name,institute_name,study_direction,course,group_name) VALUES($1,'Test','Student','Institute','Direction',1,'T-1')`, userID)
	if err != nil {
		t.Fatal(err)
	}
	var projectID string
	err = tx.QueryRowContext(ctx, `INSERT INTO student_projects(owner_id,title,category,short_description,full_description,status,visibility) VALUES($1,'Project','other','Short','Full','published','public') RETURNING project_id`, userID).Scan(&projectID)
	if err != nil {
		t.Fatal(err)
	}
	var rootID, replyID string
	err = tx.QueryRowContext(ctx, `INSERT INTO comments(resource_type,resource_id,author_id,body) VALUES('student_project',$1,$2,'root') RETURNING comment_id`, projectID, userID).Scan(&rootID)
	if err != nil {
		t.Fatalf("insert root comment: %v", err)
	}
	err = tx.QueryRowContext(ctx, `INSERT INTO comments(resource_type,resource_id,parent_comment_id,author_id,body) VALUES('student_project',$1,$2,$3,'reply') RETURNING comment_id`, projectID, rootID, userID).Scan(&replyID)
	if err != nil {
		t.Fatalf("insert reply: %v", err)
	}
	if _, err = tx.ExecContext(ctx, `SAVEPOINT before_nested_reply`); err != nil {
		t.Fatal(err)
	}
	_, nestedErr := tx.ExecContext(ctx, `INSERT INTO comments(resource_type,resource_id,parent_comment_id,author_id,body) VALUES('student_project',$1,$2,$3,'nested')`, projectID, replyID, userID)
	if nestedErr == nil {
		t.Fatal("reply to reply must be rejected")
	}
	if _, err = tx.ExecContext(ctx, `ROLLBACK TO SAVEPOINT before_nested_reply`); err != nil {
		t.Fatal(err)
	}

	var companyID string
	err = tx.QueryRowContext(ctx, `INSERT INTO companies(full_name,status) VALUES($1,'approved') RETURNING company_id`, "Company "+suffix).Scan(&companyID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO company_members(company_id,user_id,permissions) VALUES($1,$2,'["manage_company"]')`, companyID, userID)
	if err != nil {
		t.Fatal(err)
	}
	var caseID, criterionID string
	err = tx.QueryRowContext(ctx, `INSERT INTO cases(company_id,created_by,title,summary,full_brief,type,work_format,participation_mode,admission_mode,result_requirements,ip_terms) VALUES($1,$2,'Case','Summary','Brief','educational','remote','individual','open','Result','IP') RETURNING case_id`, companyID, userID).Scan(&caseID)
	if err != nil {
		t.Fatal(err)
	}
	err = tx.QueryRowContext(ctx, `INSERT INTO evaluation_criteria(case_id,name,max_score,ordinal) VALUES($1,'Quality',25,1) RETURNING criterion_id`, caseID).Scan(&criterionID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE cases SET status='moderation' WHERE case_id=$1`, caseID); err != nil {
		t.Fatal(err)
	}
	if _, err = tx.ExecContext(ctx, `SAVEPOINT before_criterion_change`); err != nil {
		t.Fatal(err)
	}
	_, criterionErr := tx.ExecContext(ctx, `UPDATE evaluation_criteria SET max_score=30 WHERE criterion_id=$1`, criterionID)
	if criterionErr == nil {
		t.Fatal("criterion change after draft must be rejected")
	}
	if _, err = tx.ExecContext(ctx, `ROLLBACK TO SAVEPOINT before_criterion_change`); err != nil {
		t.Fatal(err)
	}

	if _, err = tx.ExecContext(ctx, `INSERT INTO student_project_likes(project_id,user_id) VALUES($1,$2)`, projectID, userID); err != nil {
		t.Fatalf("insert project like: %v", err)
	}
	if _, err = tx.ExecContext(ctx, `SAVEPOINT before_duplicate_like`); err != nil {
		t.Fatal(err)
	}
	if _, duplicateLikeErr := tx.ExecContext(ctx, `INSERT INTO student_project_likes(project_id,user_id) VALUES($1,$2)`, projectID, userID); duplicateLikeErr == nil {
		t.Fatal("duplicate project like must be rejected")
	}
	if _, err = tx.ExecContext(ctx, `ROLLBACK TO SAVEPOINT before_duplicate_like`); err != nil {
		t.Fatal(err)
	}

	if _, err = tx.ExecContext(ctx, `UPDATE comments SET status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE comment_id=$1`, rootID); err != nil {
		t.Fatalf("soft delete comment: %v", err)
	}
	var retainedBody, retainedStatus string
	var hasDeletedAt bool
	err = tx.QueryRowContext(ctx, `SELECT body,status,deleted_at IS NOT NULL FROM comments WHERE comment_id=$1`, rootID).Scan(&retainedBody, &retainedStatus, &hasDeletedAt)
	if err != nil || retainedBody != "root" || retainedStatus != "deleted" || !hasDeletedAt {
		t.Fatalf("soft-deleted comment was not retained: body=%q status=%q deleted_at=%v err=%v", retainedBody, retainedStatus, hasDeletedAt, err)
	}

	oldHash, newHash := "old-"+suffix, "new-"+suffix
	var sessionID string
	err = tx.QueryRowContext(ctx, `INSERT INTO auth_sessions(user_id,refresh_token_hash,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP+INTERVAL '1 hour') RETURNING session_id`, userID, oldHash).Scan(&sessionID)
	if err != nil {
		t.Fatalf("insert auth session: %v", err)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_sessions SET refresh_token_hash=$2 WHERE session_id=$1`, sessionID, newHash); err != nil {
		t.Fatalf("rotate auth session: %v", err)
	}
	var oldCount, newCount int
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FILTER (WHERE refresh_token_hash=$1),count(*) FILTER (WHERE refresh_token_hash=$2) FROM auth_sessions WHERE session_id=$3`, oldHash, newHash, sessionID).Scan(&oldCount, &newCount); err != nil {
		t.Fatal(err)
	}
	if oldCount != 0 || newCount != 1 {
		t.Fatalf("refresh rotation did not replace token: old=%d new=%d", oldCount, newCount)
	}
}
