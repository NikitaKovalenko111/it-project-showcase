//go:build integration

package integration

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"it-project-showcase/backend/internal/models"
	case_service "it-project-showcase/backend/internal/services/cases"
	application_repo "it-project-showcase/backend/internal/storage/repositories/application"
	case_repo "it-project-showcase/backend/internal/storage/repositories/case"
	community_repo "it-project-showcase/backend/internal/storage/repositories/community"
	file_repo "it-project-showcase/backend/internal/storage/repositories/file"
	opportunity_repo "it-project-showcase/backend/internal/storage/repositories/opportunity"
	user_repo "it-project-showcase/backend/internal/storage/repositories/user"
)

// The workflow writes append-only moderation history, so run it on a disposable database.
func TestEventRegistrationAndRoundWorkflow(t *testing.T) {
	if os.Getenv("TEST_DISPOSABLE_DATABASE") != "1" {
		t.Skip("set TEST_DISPOSABLE_DATABASE=1 only for an isolated disposable database")
	}
	db := testDatabase(t)
	ctx := context.Background()
	id := func(query string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRowContext(ctx, query, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.ExecContext(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	newUser := func(student bool) string {
		t.Helper()
		name := uuid.NewString()[:18]
		user := id(`INSERT INTO showcase.users(username,email,group_name,password_hash) VALUES($1,$2,'T','hash') RETURNING user_id`, name, name+"@example.test")
		if student {
			exec(`INSERT INTO showcase.students(user_id,last_name,first_name,institute_name,study_direction,course,group_name)
				VALUES($1,'Test','Student','Institute','Direction',1,'T')`, user)
		}
		return user
	}
	manager, student, other := newUser(false), newUser(true), newUser(true)
	company := id(`INSERT INTO showcase.companies(full_name,status) VALUES($1,'approved') RETURNING company_id`, uuid.NewString())
	exec(`INSERT INTO showcase.company_members(company_id,user_id,permissions) VALUES($1,$2,'["manage_company"]')`, company, manager)
	taskFile := id(`INSERT INTO showcase.files(storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by)
		VALUES($1,'task.pdf','application/pdf',100,'test',$2) RETURNING file_id`, uuid.NewString(), manager)

	cases := case_service.Init(case_repo.Init(db))
	one := 1
	now := time.Now().UTC()
	deadline, dueAt := now.Add(30*time.Minute), now.Add(4*time.Hour)
	item, err := cases.Create(ctx, manager, models.CaseInput{
		CompanyID: company, Title: "Olympiad", Summary: "Summary", FullBrief: "Brief", Type: "educational", EventFormat: "olympiad",
		WorkFormat: "remote", ParticipationMode: "individual", AdmissionMode: "open", Capacity: &one, TeamSizeMin: &one, TeamSizeMax: &one,
		ApplicationDeadline: &deadline, DueAt: &dueAt,
		ResultRequirements: "Result", IPTerms: "Terms", Visibility: "public",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err = cases.SetEventPlan(ctx, manager, item.CaseID, models.EventPlan{
		Subject: "Programming", TimeZone: "Asia/Yekaterinburg", PlatformName: "Platform", PlatformURL: "https://example.test",
		Rounds: []models.EventRound{{Title: "Round", OpensAt: now.Add(time.Hour), DueAt: now.Add(2 * time.Hour),
			Tasks: []models.EventTask{{Title: "Task", Statement: "Secret", FileIDs: []string{taskFile}, MaxScore: 40}}}},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err = cases.SubmitForModeration(ctx, manager, item.CaseID); err != nil {
		t.Fatal(err)
	}
	if _, err = cases.Moderate(ctx, manager, item.CaseID, "approve", ""); err != nil {
		t.Fatal(err)
	}
	entries := application_repo.Init(db)
	registration := models.ApplicationInput{Registration: true, CaseID: item.CaseID, ApplicantType: "individual"}
	entry, err := entries.Create(ctx, student, registration)
	if err != nil {
		t.Fatal(err)
	}
	if entry.Status != "accepted" || entry.EntryKind != "registration" || entry.ExecutionID == nil {
		t.Fatalf("entry = %+v", entry)
	}
	if _, err = entries.Create(ctx, other, registration); !errors.Is(err, application_repo.ErrEventCapacity) {
		t.Fatalf("expected capacity error, got %v", err)
	}
	if public, err := cases.Get(ctx, item.CaseID); err != nil || public.RegistrationsCount != 1 {
		t.Fatalf("public case = %+v, err = %v", public, err)
	}
	managerPlan, err := cases.GetEventPlan(ctx, manager, item.CaseID, false)
	if err != nil {
		t.Fatal(err)
	}
	round, task := managerPlan.Rounds[0], managerPlan.Rounds[0].Tasks[0]
	studentPlan, err := cases.GetEventPlan(ctx, student, item.CaseID, false)
	if err != nil || len(studentPlan.Rounds[0].Tasks) != 0 {
		t.Fatalf("task opened early: %v, err = %v", studentPlan, err)
	}
	files := file_repo.Init(db)
	if _, err = files.GetEventTaskFile(ctx, student, item.CaseID, round.RoundID, task.TaskID, taskFile, false); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected embargo for direct file request, got %v", err)
	}
	exec(`UPDATE showcase.event_plans SET plan=jsonb_set(plan,'{rounds,0,opens_at}',to_jsonb($2::text)) WHERE case_id=$1`, item.CaseID, now.Add(-time.Minute).Format(time.RFC3339Nano))
	if _, err = files.GetEventTaskFile(ctx, student, item.CaseID, round.RoundID, task.TaskID, taskFile, false); err != nil {
		t.Fatal(err)
	}
	solutionFile := id(`INSERT INTO showcase.files(storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by)
		VALUES($1,'solution.txt','text/plain',100,'test',$2) RETURNING file_id`, uuid.NewString(), student)
	solutions := []models.EventSolution{{TaskID: task.TaskID, Text: "Solution", FileID: solutionFile}}
	if err = cases.SubmitEventRound(ctx, student, *entry.ExecutionID, round.RoundID, solutions); err != nil {
		t.Fatal(err)
	}
	if err = cases.SubmitEventRound(ctx, student, *entry.ExecutionID, round.RoundID, solutions); !errors.Is(err, case_service.ErrRoundAlreadySubmitted) {
		t.Fatalf("expected duplicate error, got %v", err)
	}
	if err = cases.GradeEventRound(ctx, manager, *entry.ExecutionID, round.RoundID, false, []models.EventTaskScore{{TaskID: task.TaskID, Score: 33}}); err != nil {
		t.Fatal(err)
	}
	graded, err := cases.ListEventRoundSubmissions(ctx, student, *entry.ExecutionID, false)
	if err != nil || len(graded) != 1 || graded[0].TotalScore == nil || *graded[0].TotalScore != 33 || graded[0].EvaluatorName != "" || len(graded[0].FileMetadata) != 0 {
		t.Fatalf("submission = %+v, err = %v", graded, err)
	}
	managerResults, err := cases.ListEventRoundSubmissions(ctx, manager, *entry.ExecutionID, false)
	if err != nil || len(managerResults) != 1 || len(managerResults[0].FileMetadata) != 1 || managerResults[0].FileMetadata[0].FileID != solutionFile {
		t.Fatalf("manager submission = %+v, err = %v", managerResults, err)
	}
	if _, err = files.GetEventSolutionFile(ctx, other, *entry.ExecutionID, round.RoundID, solutionFile, false); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("foreign solution file should be protected: %v", err)
	}
	if err = cases.ChangeDeadline(ctx, manager, item.CaseID, "", round.RoundID, now.Add(3*time.Hour), "Extended round"); err != nil {
		t.Fatal(err)
	}
	var notified bool
	if err = db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM showcase.notifications WHERE user_id=$1 AND resource_id=$2 AND type='case_deadline_changed')`, student, item.CaseID).Scan(&notified); err != nil || !notified {
		t.Fatalf("expected deadline notification, got %v, err = %v", notified, err)
	}
	for i := 0; i < 2; i++ {
		if err := cases.RecordView(ctx, item.CaseID, student); err != nil {
			t.Fatal(err)
		}
	}
	if public, err := cases.Get(ctx, item.CaseID); err != nil || public.ViewsCount != 1 {
		t.Fatalf("view count: case=%+v err=%v", public, err)
	}
	feedback := community_repo.Init(db)
	if _, err = feedback.CreateFeedback(ctx, student, "Feedback", []string{taskFile}); !errors.Is(err, community_repo.ErrFeedbackFile) {
		t.Fatalf("foreign file should be rejected: %v", err)
	}
	message, err := feedback.CreateFeedback(ctx, manager, "Feedback", []string{taskFile})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = files.GetFeedbackFile(ctx, message.FeedbackID, taskFile, student, false); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("feedback file exposed: %v", err)
	}
	if err = feedback.ReviewFeedback(ctx, manager, message.FeedbackID, "accepted"); err != nil {
		t.Fatal(err)
	}
	opportunities := opportunity_repo.Init(db)
	internship, err := opportunities.CreateInternship(ctx, manager, models.InternshipInput{CompanyID: company, Title: "Internship", Summary: "Summary", ContentMarkdown: "Description", Capacity: &one})
	if err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE showcase.internship_programs SET status='published' WHERE program_id=$1`, internship.ProgramID)
	first, err := opportunities.ApplyInternship(ctx, student, internship.ProgramID, "", "")
	if err != nil {
		t.Fatal(err)
	}
	second, err := opportunities.ApplyInternship(ctx, other, internship.ProgramID, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = opportunities.DecideInternshipApplication(ctx, manager, first.ApplicationID, "accepted"); err != nil {
		t.Fatal(err)
	}
	if _, err = opportunities.DecideInternshipApplication(ctx, manager, second.ApplicationID, "accepted"); !errors.Is(err, opportunity_repo.ErrInternshipFull) {
		t.Fatalf("expected internship capacity error: %v", err)
	}
	users := user_repo.Init(db)
	name := uuid.NewString()[:18]
	applicant, err := users.RegisterRoleApplicant(ctx, models.StudentRegistration{Username: name, Email: name + "@example.test", RequestedRole: "university_staff", ConsentVersion: "1"}, "hash")
	if err != nil {
		t.Fatal(err)
	}
	if roles, err := users.GetUserRoles(ctx, applicant); err != nil || len(roles) != 0 {
		t.Fatalf("pending applicant roles: %v %v", roles, err)
	}
	if err = users.ReviewRole(ctx, manager, applicant, "approved"); err != nil {
		t.Fatal(err)
	}
	if roles, err := users.GetUserRoles(ctx, applicant); err != nil || len(roles) != 1 || roles[0] != "university_staff" {
		t.Fatalf("approved roles: %v %v", roles, err)
	}
	two := 2
	team := id(`INSERT INTO showcase.teams(name,leader_id) VALUES('Team',$1) RETURNING team_id`, student)
	exec(`INSERT INTO showcase.team_members(team_id,student_id) VALUES($1,$2),($1,$3)`, team, student, other)
	hackathon, err := cases.Create(ctx, manager, models.CaseInput{
		CompanyID: company, Title: "Hackathon", Summary: "Summary", FullBrief: "Brief", Type: "educational", EventFormat: "hackathon",
		WorkFormat: "remote", ParticipationMode: "team", AdmissionMode: "open", Capacity: &one, TeamSizeMin: &two, TeamSizeMax: &two,
		ApplicationDeadline: &deadline, DueAt: &dueAt,
		ResultRequirements: "Result", IPTerms: "Terms", Visibility: "public",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err = cases.SetEventPlan(ctx, manager, hackathon.CaseID, models.EventPlan{
		Subject: "Programming", TimeZone: "Asia/Yekaterinburg", PlatformName: "Platform", PlatformURL: "https://example.test",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err = cases.SubmitForModeration(ctx, manager, hackathon.CaseID); err != nil {
		t.Fatal(err)
	}
	if _, err = cases.Moderate(ctx, manager, hackathon.CaseID, "approve", ""); err != nil {
		t.Fatal(err)
	}
	pending, err := entries.Create(ctx, student, models.ApplicationInput{Registration: true, CaseID: hackathon.CaseID, ApplicantType: "team", TeamID: team})
	if err != nil || pending.Status != "consent_pending" || pending.ExecutionID != nil {
		t.Fatalf("team should wait for consent: %+v %v", pending, err)
	}
	accepted, err := entries.Consent(ctx, other, pending.ApplicationID)
	if err != nil || accepted.Status != "accepted" || accepted.ExecutionID == nil {
		t.Fatalf("team acceptance: %+v %v", accepted, err)
	}
	teamExecution, err := entries.GetExecution(ctx, other, *accepted.ExecutionID, false, false)
	if err != nil || len(teamExecution.Members) != 2 {
		t.Fatalf("execution roster: %+v %v", teamExecution, err)
	}
}
