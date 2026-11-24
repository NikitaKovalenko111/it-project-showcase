//go:build integration

package integration

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/internal/services"
	case_service "it-project-showcase/backend/internal/services/cases"
	"it-project-showcase/backend/internal/storage"
	application_repo "it-project-showcase/backend/internal/storage/repositories/application"
	case_repo "it-project-showcase/backend/internal/storage/repositories/case"
	community_repo "it-project-showcase/backend/internal/storage/repositories/community"
	file_repo "it-project-showcase/backend/internal/storage/repositories/file"
	opportunity_repo "it-project-showcase/backend/internal/storage/repositories/opportunity"
	result_repo "it-project-showcase/backend/internal/storage/repositories/result"
	user_repo "it-project-showcase/backend/internal/storage/repositories/user"
	transport "it-project-showcase/backend/internal/transport/http"
	"it-project-showcase/backend/internal/transport/http/handlers"
	"it-project-showcase/backend/pkg"
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
	if err = feedback.ReviewFeedback(ctx, manager, message.FeedbackID, "reviewed"); err != nil {
		t.Fatal(err)
	}
	if err = feedback.ReviewFeedback(ctx, manager, message.FeedbackID, "accepted"); err != nil {
		t.Fatal(err)
	}
	opportunities := opportunity_repo.Init(db)
	internship, err := opportunities.CreateInternship(ctx, manager, models.InternshipInput{CompanyID: company, Kind: "internship", Title: "Internship", Summary: "Summary", ContentMarkdown: "Description", Capacity: &one})
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
		EvaluationCriteria:  []models.EvaluationCriterionInput{{Name: "Quality", MaxScore: 10, Ordinal: 1}},
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
	if withdrawn, err := cases.WithdrawModeration(ctx, manager, hackathon.CaseID); err != nil || withdrawn.Status != "draft" {
		t.Fatalf("withdraw draft: %+v %v", withdrawn, err)
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

	t.Run("administrator hides a program without removing applications", func(t *testing.T) {
		curator := newUser(false)
		exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='university_staff'`, curator)
		program, err := opportunities.CreateInternship(ctx, manager, models.InternshipInput{
			CompanyID: company, Kind: "practice", Title: "Practice", Summary: "Summary",
			ContentMarkdown: "Description", Capacity: &one, FileIDs: []string{taskFile},
		})
		if err != nil {
			t.Fatal(err)
		}
		for _, status := range []string{"moderation", "draft", "moderation"} {
			if _, err := opportunities.UpdateInternshipStatus(ctx, manager, program.ProgramID, status, "", false); err != nil {
				t.Fatal(err)
			}
		}
		if _, err := files.GetProgramFile(ctx, program.ProgramID, taskFile, student, false); !errors.Is(err, sql.ErrNoRows) {
			t.Fatalf("pending file visible to student: %v", err)
		}
		if _, err := opportunities.GetInternship(ctx, program.ProgramID, false, curator); err != nil {
			t.Fatal(err)
		}
		if _, err := files.GetProgramFile(ctx, program.ProgramID, taskFile, curator, false); err != nil {
			t.Fatal(err)
		}
		if _, err := opportunities.UpdateInternshipStatusByRole(ctx, curator, program.ProgramID, "revision", "Improve", false, true); err != nil {
			t.Fatal(err)
		}
		if _, err := opportunities.UpdateInternshipStatus(ctx, manager, program.ProgramID, "moderation", "", false); err != nil {
			t.Fatal(err)
		}
		if _, err := opportunities.UpdateInternshipStatusByRole(ctx, curator, program.ProgramID, "published", "", false, true); err != nil {
			t.Fatal(err)
		}
		if _, err := feedback.CreateReport(ctx, student, "internship", program.ProgramID, "other", ""); err != nil {
			t.Fatal(err)
		}
		if _, err := opportunities.UpdateInternshipStatusByRole(ctx, curator, program.ProgramID, "hidden", "Hide", false, true); !errors.Is(err, opportunity_repo.ErrForbidden) {
			t.Fatalf("curator hid program: %v", err)
		}
		if _, err := opportunities.UpdateInternshipStatus(ctx, manager, program.ProgramID, "hidden", "Hide", true); err != nil {
			t.Fatal(err)
		}
		if _, err := files.GetProgramFile(ctx, program.ProgramID, taskFile, manager, true); err != nil {
			t.Fatal(err)
		}
		if _, err := feedback.CreateReport(ctx, other, "internship", program.ProgramID, "other", ""); !errors.Is(err, community_repo.ErrNotFound) {
			t.Fatalf("hidden program accepted report: %v", err)
		}

		_, err = opportunities.UpdateInternshipStatus(ctx, manager, internship.ProgramID, "hidden", "Review", false)
		if !errors.Is(err, opportunity_repo.ErrForbidden) {
			t.Fatalf("company block: %v", err)
		}
		hidden, err := opportunities.UpdateInternshipStatus(ctx, manager, internship.ProgramID, "hidden", "Review", true)
		if err != nil || hidden.Status != "hidden" {
			t.Fatalf("admin block: %+v %v", hidden, err)
		}
		_, err = opportunities.GetInternship(ctx, internship.ProgramID, false, "")
		if !errors.Is(err, opportunity_repo.ErrNotFound) {
			t.Fatalf("blocked program is public: %v", err)
		}
		if got := id(`SELECT status FROM internship_applications WHERE application_id=$1`, first.ApplicationID); got != "accepted" {
			t.Fatalf("previous application status: %s", got)
		}
	})

	t.Run("active shared plan updates atomically", func(t *testing.T) {
		plan, err := cases.SavePlan(ctx, manager, hackathon.CaseID, models.CasePlanUpdate{
			Previous: []models.CasePlanStage{},
			Stages:   []models.CasePlanStage{{Title: "Prototype", DueAt: &dueAt}, {Title: "Demo"}},
		})
		if err != nil || len(plan) != 2 {
			t.Fatalf("create plan: %+v %v", plan, err)
		}
		first, second := plan[0], plan[1]
		stage := func(item models.CaseStage) models.CasePlanStage {
			return models.CasePlanStage{StageID: item.StageID, Title: item.Title, DueAt: item.DueAt}
		}
		firstDeadline := dueAt.Add(time.Hour)
		shifted := stage(first)
		shifted.DueAt = &firstDeadline
		plan, err = cases.SavePlan(ctx, manager, hackathon.CaseID, models.CasePlanUpdate{
			Previous: []models.CasePlanStage{stage(first), stage(second)},
			Stages:   []models.CasePlanStage{stage(second), shifted}, Reason: "Revised timeline",
		})
		if err != nil || plan[0].StageID != second.StageID {
			t.Fatalf("reorder plan: %+v %v", plan, err)
		}
		var synced, recorded bool
		err = db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM execution_stages WHERE execution_id=$1 AND stage_id=$2),
			EXISTS(SELECT 1 FROM case_deadline_changes WHERE stage_id=$2 AND reason='Revised timeline')`, teamExecution.ExecutionID, first.StageID).Scan(&synced, &recorded)
		if err != nil || !synced || !recorded {
			t.Fatalf("plan synchronization: %v %v %v", synced, recorded, err)
		}
		exec(`UPDATE execution_stages SET status='in_progress' WHERE execution_id=$1 AND stage_id=$2`, teamExecution.ExecutionID, first.StageID)
		_, err = cases.SavePlan(ctx, manager, hackathon.CaseID, models.CasePlanUpdate{
			Previous: []models.CasePlanStage{stage(plan[0]), stage(plan[1])},
			Stages:   []models.CasePlanStage{{Title: "Replacement"}},
		})
		if !errors.Is(err, case_service.ErrStagesLocked) {
			t.Fatalf("remove started stage: %v", err)
		}
		stages, err := cases.ListStages(ctx, hackathon.CaseID, manager, false, false)
		if err != nil || len(stages) != 2 {
			t.Fatalf("protected plan after rejected save: %+v %v", stages, err)
		}
	})

	t.Run("withdraw olympiad placements without deleting scores", func(t *testing.T) {
		rows, err := opportunities.Leaderboard(ctx, item.CaseID, manager, false)
		if err != nil || len(rows) != 1 || rows[0].TotalScore != 33 {
			t.Fatalf("organizer standings: %+v %v", rows, err)
		}
		if err = opportunities.SetPlacements(ctx, manager, item.CaseID, []models.PlacementInput{
			{ExecutionID: *entry.ExecutionID, PlaceNo: &one},
		}); err != nil {
			t.Fatal(err)
		}
		rows, err = opportunities.Leaderboard(ctx, item.CaseID, "", false)
		if err != nil || len(rows) != 1 || rows[0].PlaceNo == nil {
			t.Fatalf("published standings: %+v %v", rows, err)
		}
		if err = opportunities.WithdrawPlacements(ctx, other, item.CaseID); !errors.Is(err, opportunity_repo.ErrForbidden) {
			t.Fatalf("withdraw as a student: %v", err)
		}
		if err = opportunities.WithdrawPlacements(ctx, manager, item.CaseID); err != nil {
			t.Fatal(err)
		}
		rows, err = opportunities.Leaderboard(ctx, item.CaseID, "", false)
		if err != nil || len(rows) != 0 {
			t.Fatalf("withdrawn standings: %+v %v", rows, err)
		}
		rows, err = opportunities.Leaderboard(ctx, item.CaseID, manager, false)
		if err != nil || len(rows) != 1 || rows[0].TotalScore != 33 || rows[0].PlaceNo != nil {
			t.Fatalf("scores after withdrawal: %+v %v", rows, err)
		}
	})

	t.Run("result file metadata survives a new version", func(t *testing.T) {
		exec(`UPDATE executions SET status='in_progress' WHERE execution_id=$1`, teamExecution.ExecutionID)
		video := id(`INSERT INTO files(storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by)
			VALUES($1,'demo.mp4','video/mp4',1024,'test',$2) RETURNING file_id`, uuid.NewString(), student)
		results := result_repo.Init(db)
		input := models.SubmissionInput{Kind: "final", Title: "Demo", Description: "Solution",
			Files: []models.SubmissionFile{{FileID: video, Kind: "attachment", Ordinal: 1}}}
		initial, err := results.CreateSubmission(ctx, student, teamExecution.ExecutionID, input)
		if err != nil || len(initial.Files) != 1 || initial.Files[0].OriginalName != "demo.mp4" ||
			initial.Files[0].MIMEType != "video/mp4" {
			t.Fatalf("submission metadata: %+v %v", initial, err)
		}
		revised, err := results.CreateSubmission(ctx, other, teamExecution.ExecutionID, input)
		if err != nil || revised.VersionNo != 2 || len(revised.Files) != 1 {
			t.Fatalf("updated submission: %+v %v", revised, err)
		}
		criterion := id(`SELECT criterion_id FROM evaluation_criteria WHERE case_id=$1`, hackathon.CaseID)
		grade := models.EvaluationInput{Scores: []models.CriterionScore{{CriterionID: criterion, Score: 7}}}
		if _, err = results.CreateEvaluation(ctx, manager, revised.SubmissionID, grade); err != nil {
			t.Fatal(err)
		}
		if err = opportunities.SetPlacements(ctx, manager, hackathon.CaseID, []models.PlacementInput{{ExecutionID: teamExecution.ExecutionID, PlaceNo: &one}}); err != nil {
			t.Fatal(err)
		}
		if _, err = results.CreateEvaluation(ctx, manager, revised.SubmissionID, grade); !errors.Is(err, result_repo.ErrForbidden) {
			t.Fatalf("changed a published score: %v", err)
		}
		administrator := newUser(false)
		exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='admin'`, administrator)
		if err = opportunities.WithdrawPlacements(ctx, administrator, hackathon.CaseID); err != nil {
			t.Fatal(err)
		}
		grade.Scores[0].Score = 9
		evaluation, err := results.CreateEvaluation(ctx, manager, revised.SubmissionID, grade)
		if err != nil || evaluation.TotalScore != 9 {
			t.Fatalf("regrade after withdrawal: %+v %v", evaluation, err)
		}
	})

	t.Run("assigned curator reads results and a participant detaches a stage file", func(t *testing.T) {
		exec(`INSERT INTO student_curators(student_id,curator_id,assigned_by) VALUES($1,$2,$3)`, student, applicant, manager)
		results := result_repo.Init(db)
		items, err := results.ListSubmissions(ctx, applicant, teamExecution.ExecutionID, false, false, 10, nil, "")
		if err != nil || len(items) == 0 {
			t.Fatalf("curator submissions: %+v %v", items, err)
		}
		grades, err := results.ListEvaluations(ctx, applicant, items[0].SubmissionID, false, false)
		if err != nil || len(grades) != 1 {
			t.Fatalf("curator grades: %+v %v", grades, err)
		}
		if _, err = results.GetEvaluation(ctx, applicant, grades[0].EvaluationID, false, false); err != nil {
			t.Fatal(err)
		}
		if _, err = results.GetEvaluation(ctx, newUser(false), grades[0].EvaluationID, false, false); !errors.Is(err, result_repo.ErrForbidden) {
			t.Fatalf("unrelated user grade: %v", err)
		}
		stage := id(`SELECT stage_id FROM case_stages WHERE case_id=$1 ORDER BY ordinal LIMIT 1`, hackathon.CaseID)
		exec(`UPDATE executions SET status='in_progress' WHERE execution_id=$1`, teamExecution.ExecutionID)
		exec(`UPDATE execution_stages SET status='submitted' WHERE execution_id=$1 AND stage_id=$2`, teamExecution.ExecutionID, stage)
		fileID := items[0].Files[0].FileID
		submission, err := results.CreateSubmission(ctx, student, teamExecution.ExecutionID, models.SubmissionInput{
			Kind: "stage", StageID: stage, Title: "Checkpoint", Description: "Checkpoint",
			Files: []models.SubmissionFile{{FileID: fileID, Kind: "attachment", Ordinal: 1}},
		})
		if err != nil {
			t.Fatal(err)
		}
		files := file_repo.Init(db)
		if _, err = files.GetSubmissionFile(ctx, submission.SubmissionID, fileID, applicant, false); err != nil {
			t.Fatal(err)
		}
		for range 2 {
			if err = results.DetachStageFile(ctx, student, submission.SubmissionID, fileID); err != nil {
				t.Fatal(err)
			}
		}
		if _, err = files.GetSubmissionFile(ctx, submission.SubmissionID, fileID, applicant, false); !errors.Is(err, sql.ErrNoRows) {
			t.Fatalf("detached attachment is still accessible: %v", err)
		}
		if _, err = files.GetSubmissionFile(ctx, items[0].SubmissionID, fileID, applicant, false); err != nil {
			t.Fatalf("attachment vanished from another submission: %v", err)
		}
	})

	t.Run("expired case cannot be submitted or approved", func(t *testing.T) {
		skill := id(`SELECT competency_id FROM showcase.competencies WHERE name='Python' AND is_active`)
		input := models.CaseInput{
			CompanyID: company, Title: "Case", Summary: "Summary", FullBrief: "Brief", Type: "educational",
			WorkFormat: "remote", ParticipationMode: "individual", AdmissionMode: "open",
			Capacity: &one, TeamSizeMin: &one, TeamSizeMax: &one, DueAt: &dueAt,
			ResultRequirements: "Result", IPTerms: "Terms", Visibility: "public",
			Competencies: []models.CaseCompetencyInput{{ID: skill}},
		}
		draft, err := cases.Create(ctx, manager, input)
		if err != nil {
			t.Fatal(err)
		}
		expired := now.Add(-time.Hour)
		exec(`UPDATE showcase.cases SET due_at=$2 WHERE case_id=$1`, draft.CaseID, expired)
		if _, err = cases.SubmitForModeration(ctx, manager, draft.CaseID); !errors.Is(err, case_service.ErrDeadlineExpired) {
			t.Fatalf("submit expired case: %v", err)
		}
		exec(`UPDATE showcase.cases SET due_at=$2 WHERE case_id=$1`, draft.CaseID, dueAt)
		if _, err = cases.SubmitForModeration(ctx, manager, draft.CaseID); err != nil {
			t.Fatal(err)
		}
		exec(`UPDATE showcase.cases SET due_at=$2 WHERE case_id=$1`, draft.CaseID, expired)
		if _, err = cases.Moderate(ctx, manager, draft.CaseID, "approve", ""); !errors.Is(err, case_service.ErrDeadlineExpired) {
			t.Fatalf("approve expired case: %v", err)
		}
	})

	const secret = "integration-test-secret"
	svc := services.Init(&storage.Storage{Db: db}, testObjects{}, config.JWT{}, config.ObjectStorage{MaxFileSize: 20 << 20}, config.Email{})
	mux := http.NewServeMux()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	transport.Init(handlers.Init(svc), middleware.Authorization(secret, logger)).Start(mux)
	api := middleware.RequestID(mux)
	request := func(method, path, token, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/api/v1"+path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		req.Header.Set("X-Request-ID", "qa-workflow-request")
		response := httptest.NewRecorder()
		api.ServeHTTP(response, req)
		return response
	}

	t.Run("approved representatives join a moderated company", func(t *testing.T) {
		tokenFor := func(user, role string) string {
			t.Helper()
			token, _, err := pkg.CreateAccessTokenWithRoles(user, []string{role}, secret, time.Minute)
			if err != nil {
				t.Fatal(err)
			}
			return token
		}
		administrator := newUser(false)
		exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='admin'`, administrator)
		adminToken := tokenFor(administrator, "admin")
		send := func(method, path, token string, input any, expected int) []byte {
			t.Helper()
			var payload []byte
			if input != nil {
				payload, _ = json.Marshal(input)
			}
			res := request(method, path, token, string(payload))
			if res.Code != expected {
				t.Fatalf("%s %s: %d %s", method, path, res.Code, res.Body)
			}
			return res.Body.Bytes()
		}
		register := func() string {
			t.Helper()
			name := "rep_" + uuid.NewString()[:12]
			var result struct {
				UserID string `json:"user_id"`
			}
			data := send(http.MethodPost, "/auth/register", "", map[string]string{"username": name, "email": name + "@example.test", "password": "Example12345", "role": "company_representative", "consent_version": "1"}, 201)
			if err := json.Unmarshal(data, &result); err != nil {
				t.Fatal(err)
			}
			return result.UserID
		}
		approve := func(user string) {
			t.Helper()
			send(http.MethodPatch, "/users/"+user+"/role-request", adminToken, map[string]string{"status": "approved"}, 204)
		}
		firstRep, secondRep := register(), register()
		approve(firstRep)
		firstToken, secondToken := tokenFor(firstRep, "company_representative"), tokenFor(secondRep, "company_representative")
		var company models.Company
		data := send(http.MethodPost, "/companies", firstToken, map[string]string{"full_name": "Pipeline " + uuid.NewString(), "position": "Director", "inn": "7707083893"}, 201)
		if err := json.Unmarshal(data, &company); err != nil {
			t.Fatal(err)
		}
		if company.INN != "7707083893" || strings.Contains(string(data), "\"kpp\"") || strings.Contains(string(data), "\"ogrn\"") || strings.Contains(string(data), "\"legal_address\"") {
			t.Fatalf("company requisites: %s", data)
		}
		var storedINN string
		if err := db.QueryRowContext(ctx, `SELECT inn FROM companies WHERE company_id=$1`, company.CompanyID).Scan(&storedINN); err != nil || storedINN != company.INN {
			t.Fatalf("stored INN: %q %v", storedINN, err)
		}
		for _, inn := range []string{"", "7707083894"} {
			send(http.MethodPost, "/companies", firstToken, map[string]string{"full_name": "Invalid INN", "inn": inn}, 422)
			send(http.MethodPut, "/companies/"+company.CompanyID, firstToken, map[string]string{"full_name": company.FullName, "inn": inn}, 422)
		}
		send(http.MethodPatch, "/companies/"+company.CompanyID+"/legal", firstToken, map[string]string{"inn": "7707083893"}, 404)
		invitePath := "/companies/" + company.CompanyID + "/member-invitations"
		invite := func(user string, expected int) []byte {
			t.Helper()
			return send(http.MethodPost, invitePath, firstToken, map[string]string{"user_id": user, "position": "Developer"}, expected)
		}
		approve(secondRep)
		invite(secondRep, 404) // Company must also finish moderation.
		send(http.MethodPost, "/companies/"+company.CompanyID+"/submit-moderation", firstToken, nil, 200)
		send(http.MethodPatch, "/companies/"+company.CompanyID+"/moderation", adminToken, map[string]string{"status": "approved"}, 200)
		for _, state := range []string{"student", "pending", "rejected", "role_without_approval", "blocked"} {
			target := newUser(state == "student")
			if state != "student" {
				status := "approved"
				if state == "pending" || state == "rejected" {
					status = state
				}
				if state != "role_without_approval" {
					exec(`INSERT INTO role_requests(user_id,role_code,status) VALUES($1,'company_representative',$2)`, target, status)
				}
				exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='company_representative'`, target)
				if state == "blocked" {
					exec(`UPDATE users SET status='blocked' WHERE user_id=$1`, target)
				}
			}
			data := invite(target, 403)
			if !strings.Contains(string(data), "representative_approval_required") {
				t.Fatalf("%s: %s", state, data)
			}
		}
		var invitation models.CompanyMemberInvitation
		if err := json.Unmarshal(invite(secondRep, 201), &invitation); err != nil {
			t.Fatal(err)
		}
		var notification string
		if err := db.QueryRowContext(ctx, `SELECT notification_id FROM notifications WHERE user_id=$1 AND type='company_member_invitation' AND resource_id=$2`, secondRep, invitation.InvitationID).Scan(&notification); err != nil {
			t.Fatal(err)
		}
		responsePath := "/company-member-invitations/" + invitation.InvitationID
		send(http.MethodPatch, responsePath, firstToken, map[string]string{"status": "accepted"}, 404)
		// Existing invitations cannot bypass revoked approval, blocking or changed roles.
		exec(`UPDATE role_requests SET status='rejected' WHERE user_id=$1`, secondRep)
		send(http.MethodPatch, responsePath, secondToken, map[string]string{"status": "accepted"}, 403)
		exec(`UPDATE role_requests SET status='approved' WHERE user_id=$1`, secondRep)
		exec(`UPDATE users SET status='blocked' WHERE user_id=$1`, secondRep)
		send(http.MethodPatch, responsePath, secondToken, map[string]string{"status": "accepted"}, 403)
		exec(`UPDATE users SET status='active' WHERE user_id=$1`, secondRep)
		exec(`DELETE FROM user_roles WHERE user_id=$1`, secondRep)
		send(http.MethodPatch, responsePath, secondToken, map[string]string{"status": "accepted"}, 403)
		var roles int
		if err := db.QueryRowContext(ctx, `SELECT count(*) FROM user_roles WHERE user_id=$1`, secondRep).Scan(&roles); err != nil || roles != 0 {
			t.Fatalf("invitation granted a role: %d %v", roles, err)
		}
		exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='company_representative'`, secondRep)
		exec(`UPDATE companies SET status='suspended' WHERE company_id=$1`, company.CompanyID)
		send(http.MethodPatch, responsePath, secondToken, map[string]string{"status": "accepted"}, 422)
		exec(`UPDATE companies SET status='approved' WHERE company_id=$1`, company.CompanyID)
		var acceptedCompany models.Company
		if err := json.Unmarshal(send(http.MethodPatch, responsePath, secondToken, map[string]string{"status": "accepted"}, 200), &acceptedCompany); err != nil {
			t.Fatal(err)
		}
		if acceptedCompany.CompanyID != company.CompanyID {
			t.Fatal("wrong joined company")
		}
		var members int
		if err := db.QueryRowContext(ctx, `SELECT count(*) FROM company_members WHERE company_id=$1 AND status='active' AND permissions ? 'manage_company'`, company.CompanyID).Scan(&members); err != nil || members != 2 {
			t.Fatalf("members: %d %v", members, err)
		}
		send(http.MethodPatch, responsePath, secondToken, map[string]string{"status": "accepted"}, 422)
		if err := db.QueryRowContext(ctx, `SELECT count(*) FROM user_roles WHERE user_id=$1`, secondRep).Scan(&roles); err != nil || roles != 1 {
			t.Fatalf("roles changed: %d %v", roles, err)
		}
		thirdRep := register()
		approve(thirdRep)
		var declined models.CompanyMemberInvitation
		if err := json.Unmarshal(invite(thirdRep, 201), &declined); err != nil {
			t.Fatal(err)
		}
		send(http.MethodPatch, "/company-member-invitations/"+declined.InvitationID, tokenFor(thirdRep, "company_representative"), map[string]string{"status": "declined"}, 200)
		var joined bool
		if err := db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM company_members WHERE company_id=$1 AND user_id=$2)`, company.CompanyID, thirdRep).Scan(&joined); err != nil || joined {
			t.Fatalf("decline created membership: %v %v", joined, err)
		}
		var updated models.Company
		data = send(http.MethodPut, "/companies/"+company.CompanyID, firstToken, map[string]string{"full_name": company.FullName, "inn": "500100732259"}, 200)
		if err := json.Unmarshal(data, &updated); err != nil {
			t.Fatal(err)
		}
		if updated.INN != "500100732259" || updated.Status != "pending" {
			t.Fatalf("updated INN/status: %s", data)
		}
		if err := db.QueryRowContext(ctx, `SELECT inn FROM companies WHERE company_id=$1`, company.CompanyID).Scan(&storedINN); err != nil || storedINN != updated.INN {
			t.Fatalf("updated stored INN: %q %v", storedINN, err)
		}
		var removedColumns int
		if err := db.QueryRowContext(ctx, `SELECT count(*) FROM information_schema.columns WHERE table_schema='showcase' AND table_name='companies' AND column_name IN ('kpp','ogrn','legal_address')`).Scan(&removedColumns); err != nil || removedColumns != 0 {
			t.Fatalf("obsolete requisites remain: %d %v", removedColumns, err)
		}
	})
	t.Run("moderator replaces role and the old access token is rejected", func(t *testing.T) {
		administrator, account := newUser(false), newUser(false)
		exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='admin'`, administrator)
		exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='university_staff'`, account)
		adminToken, _, err := pkg.CreateAccessTokenWithRoles(administrator, []string{"admin"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		oldToken, _, err := pkg.CreateAccessTokenWithRoles(account, []string{"university_staff"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		response := request(http.MethodPatch, "/users/"+account+"/role", adminToken, `{"role":"company_representative"}`)
		if response.Code != http.StatusNoContent {
			t.Fatalf("change role: %d %s", response.Code, response.Body)
		}
		current, err := users.GetUserRoles(ctx, account)
		if err != nil || len(current) != 1 || current[0] != "company_representative" {
			t.Fatalf("changed roles: %v %v", current, err)
		}
		verify := middleware.Authorization(secret, logger, users.GetActiveUserRoles)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+oldToken)
		res := httptest.NewRecorder()
		verify.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("old role token: %d", res.Code)
		}
	})

	t.Run("admin prepares and publishes company listings", func(t *testing.T) {
		administrator, anotherAdmin := newUser(false), newUser(false)
		for _, actor := range []string{administrator, anotherAdmin} {
			exec(`INSERT INTO user_roles(user_id,role_id) SELECT $1,role_id FROM roles WHERE code='admin'`, actor)
		}
		adminToken := func(actor string) string {
			t.Helper()
			token, _, err := pkg.CreateAccessTokenWithRoles(actor, []string{"admin"}, secret, time.Minute)
			if err != nil {
				t.Fatal(err)
			}
			return token
		}
		send := func(method, path, token string, input any, expected int) []byte {
			t.Helper()
			var payload []byte
			if input != nil {
				var err error
				payload, err = json.Marshal(input)
				if err != nil {
					t.Fatal(err)
				}
			}
			response := request(method, path, token, string(payload))
			if response.Code != expected {
				t.Fatalf("%s %s: %d %s", method, path, response.Code, response.Body)
			}
			return response.Body.Bytes()
		}
		token := adminToken(administrator)
		foreignInput := models.CaseInput{
			CompanyID: company, Title: "Company owned hackathon", Summary: "Summary", FullBrief: "Brief", Type: "educational",
			EventFormat: "hackathon", WorkFormat: "remote", ParticipationMode: "individual", AdmissionMode: "open",
			Capacity: &one, TeamSizeMin: &one, TeamSizeMax: &one, ApplicationDeadline: &deadline, DueAt: &dueAt,
			ResultRequirements: "Result", IPTerms: "Terms", Visibility: "public",
			Files: []models.CaseFileInput{{FileID: taskFile, Visibility: "public"}},
		}
		foreign, err := cases.Create(ctx, manager, foreignInput)
		if err != nil {
			t.Fatal(err)
		}
		foreignPath := "/cases/" + foreign.CaseID
		foreignPlan := models.EventPlan{
			Subject: "Programming", TimeZone: "Asia/Yekaterinburg", PlatformName: "Platform", PlatformURL: "https://example.test",
			Rounds: []models.EventRound{{Title: "Final", OpensAt: now.Add(time.Hour), DueAt: dueAt,
				Tasks: []models.EventTask{{Title: "Task", Statement: "Problem", FileIDs: []string{taskFile}, MaxScore: 30}}}},
		}
		if err = cases.SetEventPlan(ctx, manager, foreign.CaseID, foreignPlan); err != nil {
			t.Fatal(err)
		}
		foreignInput.Title = "Edited by administrator"
		var edited models.Case
		if err = json.Unmarshal(send(http.MethodPut, foreignPath, token, foreignInput, 200), &edited); err != nil {
			t.Fatal(err)
		}
		if edited.CreatedBy != manager || edited.TermsVersion != 2 || len(edited.Files) != 1 || edited.Files[0].FileID != taskFile {
			t.Fatalf("foreign case or original attachment changed: %+v", edited)
		}
		send(http.MethodPut, foreignPath+"/event-plan", token, foreignPlan, 204)
		send(http.MethodPost, foreignPath+"/stages", token, models.CaseStageInput{Title: "Admin checkpoint", Ordinal: 1}, 201)
		outsider := newUser(false)
		unrelatedFile := id(`INSERT INTO files(storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by)
			VALUES($1,'unrelated.pdf','application/pdf',12,'test',$2) RETURNING file_id`, uuid.NewString(), outsider)
		foreignInput.Files = []models.CaseFileInput{{FileID: unrelatedFile, Visibility: "public"}}
		send(http.MethodPut, foreignPath, token, foreignInput, 422)
		foreignInput.Files = []models.CaseFileInput{{FileID: taskFile, Visibility: "public"}}
		send(http.MethodPost, foreignPath+"/submit-moderation", token, nil, 200)
		send(http.MethodPatch, foreignPath+"/moderation", token, map[string]string{"decision": "approve"}, 200)
		if err = json.Unmarshal(send(http.MethodPut, foreignPath, token, foreignInput, 200), &edited); err != nil {
			t.Fatal(err)
		}
		if edited.Status != "revision" || edited.CreatedBy != manager {
			t.Fatalf("published edit must create revision: %+v", edited)
		}
		auditActor := id(`SELECT actor_id FROM audit_logs WHERE entity_id=$1 AND new_data->>'terms_version'='3'
			AND entity_type='case' AND action='update'`, foreign.CaseID)
		if auditActor != administrator {
			t.Fatalf("wrong edit author: %s", auditActor)
		}

		image := id(`INSERT INTO files(storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by)
			VALUES($1,'cover.png','image/png',12,'test',$2) RETURNING file_id`, uuid.NewString(), administrator)
		caseInput := models.CaseInput{
			CompanyID: company, Title: "Admin hackathon", Summary: "Summary", FullBrief: "Brief", Type: "educational",
			EventFormat: "hackathon", WorkFormat: "remote", ParticipationMode: "individual", AdmissionMode: "open",
			Capacity: &one, TeamSizeMin: &one, TeamSizeMax: &one, ApplicationDeadline: &deadline, DueAt: &dueAt,
			ResultRequirements: "Result", IPTerms: "Terms", Visibility: "public",
		}
		var created models.Case
		if err := json.Unmarshal(send(http.MethodPost, "/cases", token, caseInput, 201), &created); err != nil {
			t.Fatal(err)
		}
		if created.CreatedBy != administrator || created.Status != "draft" {
			t.Fatalf("case author or status: %+v", created)
		}
		send(http.MethodGet, "/cases/mine", token, nil, 200)
		casePath := "/cases/" + created.CaseID
		caseInput.Title = "Edited admin hackathon"
		send(http.MethodPut, casePath, adminToken(anotherAdmin), caseInput, 200)
		send(http.MethodPut, casePath, token, caseInput, 200)
		send(http.MethodPut, casePath+"/cover", token, map[string]string{"file_id": image}, 204)
		send(http.MethodPost, casePath+"/stages", token, models.CaseStageInput{Title: "Checkpoint", Ordinal: 1}, 201)
		send(http.MethodPut, casePath+"/event-plan", token, models.EventPlan{
			Subject: "Programming", TimeZone: "Asia/Yekaterinburg", PlatformName: "Platform", PlatformURL: "https://example.test",
		}, 204)
		send(http.MethodPost, casePath+"/submit-moderation", token, nil, 200)
		send(http.MethodPatch, casePath+"/moderation", token, map[string]string{"decision": "approve"}, 200)
		if actor := id(`SELECT moderator_id FROM case_moderation_events WHERE case_id=$1 AND decision='approve'`, created.CaseID); actor != administrator {
			t.Fatalf("case moderator: %s", actor)
		}
		send(http.MethodPatch, casePath+"/moderation", token, map[string]string{"decision": "request_revision", "comment": "Update published brief"}, 200)
		// Legacy confidential records may reach moderation without an NDA.
		confidentialInput := foreignInput
		confidentialInput.NDARequired = true
		confidential, err := cases.Create(ctx, manager, confidentialInput)
		if err != nil {
			t.Fatal(err)
		}
		ndaPath := "/cases/" + confidential.CaseID
		if err := cases.SetEventPlan(ctx, manager, confidential.CaseID, foreignPlan); err != nil {
			t.Fatal(err)
		}
		rejected := request(http.MethodPost, ndaPath+"/submit-moderation", token, "")
		if rejected.Code != 409 || !strings.Contains(rejected.Body.String(), "nda_version_required") {
			t.Fatalf("missing NDA: %d %s", rejected.Code, rejected.Body)
		}
		exec(`UPDATE cases SET status='moderation' WHERE case_id=$1`, confidential.CaseID)
		rejected = request(http.MethodPatch, ndaPath+"/moderation", token, `{"decision":"approve"}`)
		if rejected.Code != 409 {
			t.Fatalf("legacy NDA approval: %d %s", rejected.Code, rejected.Body)
		}
		send(http.MethodPatch, ndaPath+"/moderation", token, map[string]string{"decision": "request_revision", "comment": "Attach NDA"}, 200)
		send(http.MethodPost, ndaPath+"/nda-versions", token, map[string]string{"text": "Confidentiality agreement"}, 201)
		send(http.MethodPost, ndaPath+"/submit-moderation", token, nil, 200)
		send(http.MethodPatch, ndaPath+"/moderation", token, map[string]string{"decision": "approve"}, 200)
		for _, kind := range []string{"internship", "practice"} {
			input := models.InternshipInput{CompanyID: company, Title: "Admin " + kind, Summary: "Summary", ContentMarkdown: "Description", Kind: kind, Capacity: &one, FileIDs: []string{image}}
			var program models.InternshipProgram
			if err := json.Unmarshal(send(http.MethodPost, "/internships", token, input, 201), &program); err != nil {
				t.Fatal(err)
			}
			send(http.MethodGet, "/internships/mine", token, nil, 200)
			programPath := "/internships/" + program.ProgramID
			input.Title = "Edited " + kind
			send(http.MethodPut, programPath, adminToken(anotherAdmin), input, 200)
			for _, status := range []string{"moderation", "published"} {
				send(http.MethodPatch, programPath+"/status", adminToken(anotherAdmin), map[string]string{"status": status}, 200)
			}
			var revised models.InternshipProgram
			if err := json.Unmarshal(send(http.MethodPut, programPath, adminToken(anotherAdmin), input, 200), &revised); err != nil {
				t.Fatal(err)
			}
			if revised.Status != "revision" || revised.CreatedBy != administrator {
				t.Fatalf("foreign published program edit: %+v", revised)
			}
			if actor := id(`SELECT actor_id FROM audit_logs WHERE entity_id=$1 AND entity_type='internship'
				AND new_data->>'status'='published'`, program.ProgramID); actor != anotherAdmin {
				t.Fatalf("program publisher: %s", actor)
			}
		}
	})

	t.Run("execution replies and common program application queue", func(t *testing.T) {
		tokenFor := func(user, role string) string {
			t.Helper()
			token, _, err := pkg.CreateAccessTokenWithRoles(user, []string{role}, secret, time.Minute)
			if err != nil {
				t.Fatal(err)
			}
			return token
		}
		studentToken := tokenFor(student, "student")
		postComment := func(execution, parent string, expected int) models.ExecutionComment {
			t.Helper()
			payload, _ := json.Marshal(map[string]string{"body": "Discussion message", "parent_comment_id": parent})
			res := request(http.MethodPost, "/executions/"+execution+"/comments", studentToken, string(payload))
			if res.Code != expected {
				t.Fatalf("reply: %d %s", res.Code, res.Body)
			}
			var comment models.ExecutionComment
			if expected == 201 {
				if err := json.Unmarshal(res.Body.Bytes(), &comment); err != nil {
					t.Fatal(err)
				}
			}
			return comment
		}
		root := postComment(teamExecution.ExecutionID, "", 201)
		reply := postComment(teamExecution.ExecutionID, root.CommentID, 201)
		if reply.ParentCommentID == nil || *reply.ParentCommentID != root.CommentID {
			t.Fatalf("missing parent: %+v", reply)
		}
		if root.AuthorName != "Test Student" || reply.AuthorName != root.AuthorName {
			t.Fatalf("comment author names: %q, %q", root.AuthorName, reply.AuthorName)
		}
		postComment(teamExecution.ExecutionID, uuid.NewString(), 403)
		postComment(*entry.ExecutionID, root.CommentID, 403)
		res := request(http.MethodGet, "/executions/"+teamExecution.ExecutionID+"/comments", studentToken, "")
		if res.Code != 200 || !strings.Contains(res.Body.String(), root.CommentID) ||
			!strings.Contains(res.Body.String(), "parent_comment_id") || !strings.Contains(res.Body.String(), "Test Student") {
			t.Fatalf("list replies: %d %s", res.Code, res.Body)
		}
		ownCompany := id(`INSERT INTO companies(full_name,status) VALUES('Queue company','approved') RETURNING company_id`)
		exec(`INSERT INTO company_members(company_id,user_id,permissions) VALUES($1,$2,'["manage_company"]')`, ownCompany, manager)
		for _, kind := range []string{"internship", "practice"} {
			program := id(`INSERT INTO internship_programs(company_id,created_by,title,summary,content_markdown,status,kind)
            VALUES($1,$2,$3,'Summary','Description','published',$4) RETURNING program_id`, ownCompany, manager, "Queue "+kind, kind)
			exec(`INSERT INTO internship_applications(program_id,student_id) VALUES($1,$2)`, program, student)
		}
		companyToken := tokenFor(manager, "company_representative")
		res = request(http.MethodGet, "/internships/applications?company_id="+ownCompany+"&page_size=1", companyToken, "")
		var page struct {
			Items []models.InternshipApplication `json:"items"`
			Total int                            `json:"total"`
		}
		if res.Code != 200 {
			t.Fatalf("queue: %d %s", res.Code, res.Body)
		}
		if err := json.Unmarshal(res.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		if page.Total != 2 || len(page.Items) != 1 {
			t.Fatalf("queue pagination: %s", res.Body)
		}
		res = request(http.MethodGet, "/internships/applications?company_id="+ownCompany+"&kind=practice&status=submitted&search=Queue", companyToken, "")
		if res.Code != 200 || !strings.Contains(res.Body.String(), `"program_kind":"practice"`) || strings.Contains(res.Body.String(), `"program_kind":"internship"`) {
			t.Fatalf("queue filters: %d %s", res.Code, res.Body)
		}
		res = request(http.MethodGet, "/internships/applications", tokenFor(newUser(false), "company_representative"), "")
		if res.Code != 200 || !strings.Contains(res.Body.String(), `"total":0`) {
			t.Fatalf("queue isolation: %d %s", res.Code, res.Body)
		}
		res = request(http.MethodGet, "/internships/applications?kind=bad", companyToken, "")
		if res.Code != 422 {
			t.Fatalf("invalid queue filter: %d %s", res.Code, res.Body)
		}
		res = request(http.MethodGet, "/internships/applications", studentToken, "")
		if res.Code != 403 {
			t.Fatalf("student company queue: %d", res.Code)
		}
	})

	t.Run("endpoint regressions for comments favorites consents and streaming", func(t *testing.T) {
		token, _, err := pkg.CreateAccessTokenWithRoles(student, []string{"student"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		community := community_repo.Init(db)
		comment, err := community.CreateComment(ctx, student, "case", item.CaseID, nil, "Comment to delete")
		if err != nil {
			t.Fatal(err)
		}
		reply, err := community.CreateComment(ctx, other, "case", item.CaseID, &comment.CommentID, "Keep this reply")
		if err != nil {
			t.Fatal(err)
		}
		response := request(http.MethodDelete, "/comments/"+comment.CommentID, token, "")
		if response.Code != 204 {
			t.Fatalf("delete comment: %d %s", response.Code, response.Body)
		}
		var body, status string
		var deletedAt bool
		if err = db.QueryRowContext(ctx, `SELECT body,status,deleted_at IS NOT NULL FROM comments WHERE comment_id=$1`, comment.CommentID).Scan(&body, &status, &deletedAt); err != nil {
			t.Fatal(err)
		}
		if body != "Comment to delete" || status != "deleted" || !deletedAt {
			t.Fatalf("invalid soft delete: %q %q %v", body, status, deletedAt)
		}
		visible, err := community.GetComment(ctx, comment.CommentID)
		if err != nil || visible.Body != "" || visible.Status != "deleted" {
			t.Fatalf("deleted content leaked: %+v %v", visible, err)
		}
		if _, err = community.GetComment(ctx, reply.CommentID); err != nil {
			t.Fatalf("reply lost: %v", err)
		}
		for _, method := range []string{http.MethodPut, http.MethodPut, http.MethodDelete} {
			response = request(method, "/favorites/case/"+item.CaseID, token, "")
			if response.Code != 200 || !strings.Contains(response.Body.String(), `"favorite":`) {
				t.Fatalf("favorite: %d %s", response.Code, response.Body)
			}
		}

		consentTeam := id(`INSERT INTO teams(name,leader_id) VALUES('Consent regression',$1) RETURNING team_id`, student)
		exec(`INSERT INTO team_members(team_id,student_id) VALUES($1,$2),($1,$3)`, consentTeam, student, other)
		consentApplication := id(`INSERT INTO applications(case_id,case_revision_id,submitted_by,team_id,status)
			SELECT $1,case_revision_id,$2,$3,'consent_pending' FROM case_revisions WHERE case_id=$1 AND version_no=1 RETURNING application_id`,
			hackathon.CaseID, student, consentTeam)
		response = request(http.MethodPost, "/applications/"+consentApplication+"/consents", token, "")
		if response.Code != 200 || !strings.Contains(response.Body.String(), consentApplication) {
			t.Fatalf("consent: %d %s", response.Code, response.Body)
		}

		loggedAPI := middleware.Logger(logger)(middleware.TimeoutExcept(time.Millisecond, "/api/v1/notifications/stream")(api))
		server := httptest.NewServer(loggedAPI)
		defer server.Close()
		streamCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(streamCtx, http.MethodGet, server.URL+"/api/v1/notifications/stream", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		stream, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer stream.Body.Close()
		if stream.StatusCode != 200 || !strings.HasPrefix(stream.Header.Get("Content-Type"), "text/event-stream") {
			t.Fatalf("SSE: %d %s", stream.StatusCode, stream.Header)
		}
		scanner := bufio.NewScanner(stream.Body)
		waitForEvent := func(event string) {
			t.Helper()
			for scanner.Scan() {
				if scanner.Text() == "event: "+event {
					return
				}
			}
			t.Fatalf("missing SSE event %s: %v", event, scanner.Err())
		}
		waitForEvent("connected")
		exec(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'test','SSE regression','New event')`, student)
		waitForEvent("notification")
	})

	t.Run("registration profile and curator directory", func(t *testing.T) {
		name := "qa-" + uuid.NewString()[:12]
		profile := `"first_name":"Test","last_name":"Student","institute":"Institute","direction":"Direction","group_name":"QA-101","course":2`
		registration := `{"username":"` + name + `","password":"Password123","consent_version":"1",` + profile + `,"email":"` + name
		response := request(http.MethodPost, "/auth/register", "", registration+`@gmail.com"}`)
		if response.Code != http.StatusUnprocessableEntity || !strings.Contains(response.Body.String(), "student_domain_required") {
			t.Fatalf("invalid registration: %d %s", response.Code, response.Body)
		}
		email := name + "@stud.uust.ru"
		response = request(http.MethodPost, "/auth/register", "", registration+`@stud.uust.ru"}`)
		var account struct {
			ID string `json:"user_id"`
		}
		if response.Code != http.StatusCreated || json.Unmarshal(response.Body.Bytes(), &account) != nil || account.ID == "" {
			t.Fatalf("valid registration: %d %s", response.Code, response.Body)
		}
		token, _, err := pkg.CreateAccessTokenWithRoles(account.ID, []string{"student"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		response = request(http.MethodPut, "/students/me/profile", token, `{`+profile+`,"email":"`+email+`","phone":"+7 917 123 45 67","bio":"Updated"}`)
		if response.Code != http.StatusNoContent {
			t.Fatalf("profile update: %d %s", response.Code, response.Body)
		}
		response = request(http.MethodGet, "/auth/me", token, "")
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), email) ||
			!strings.Contains(response.Body.String(), "QA-101") || !strings.Contains(response.Body.String(), "Updated") {
			t.Fatalf("updated profile: %d %s", response.Code, response.Body)
		}
		curatorToken, _, err := pkg.CreateAccessTokenWithRoles(applicant, []string{"university_staff"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		response = request(http.MethodGet, "/students/search", curatorToken, "")
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), account.ID) || strings.Contains(response.Body.String(), other) {
			t.Fatalf("curator student directory: %d %s", response.Code, response.Body)
		}
	})

	t.Run("account avatar and video upload", func(t *testing.T) {
		token, _, err := pkg.CreateAccessTokenWithRoles(manager, []string{"company_representative"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		upload := func(method, path, name string, contents []byte) *httptest.ResponseRecorder {
			t.Helper()
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("file", name)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = part.Write(contents); err != nil {
				t.Fatal(err)
			}
			if err = writer.Close(); err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(method, "/api/v1"+path, &body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.Header.Set("Authorization", "Bearer "+token)
			res := httptest.NewRecorder()
			api.ServeHTTP(res, req)
			return res
		}
		image, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHZ8AAAAASUVORK5CYII=")
		if err != nil {
			t.Fatal(err)
		}
		res := upload(http.MethodPut, "/users/me/avatar", "avatar.png", image)
		if res.Code != http.StatusOK {
			t.Fatalf("avatar upload: %d %s", res.Code, res.Body)
		}
		res = request(http.MethodGet, "/users/"+manager+"/avatar", "", "")
		if res.Code != http.StatusOK || !bytes.Equal(res.Body.Bytes(), image) {
			t.Fatalf("avatar download: %d", res.Code)
		}
		res = request(http.MethodGet, "/auth/me", token, "")
		if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), "avatar_file_id") {
			t.Fatalf("account avatar: %d %s", res.Code, res.Body)
		}
		video := []byte{0, 0, 0, 20, 'f', 't', 'y', 'p', 'm', 'p', '4', '2', 0, 0, 0, 0, 'm', 'p', '4', '2'}
		res = upload(http.MethodPost, "/files", "demo.mp4", video)
		if res.Code != http.StatusCreated || !strings.Contains(res.Body.String(), "video/mp4") {
			t.Fatalf("video upload: %d %s", res.Code, res.Body)
		}
	})

	t.Run("status audit records the authenticated actor and reason", func(t *testing.T) {
		token, _, err := pkg.CreateAccessTokenWithRoles(manager, []string{"admin"}, secret, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		response := request(http.MethodPatch, "/users/"+other+"/status", token, `{"status":"blocked","reason":"QA status review"}`)
		if response.Code != http.StatusNoContent {
			t.Fatalf("status update: %d %s", response.Code, response.Body)
		}

		actor := id(`SELECT actor_id FROM showcase.audit_logs
			WHERE entity_type='user' AND entity_id=$1 AND request_id='qa-workflow-request'
			AND new_data->>'status_reason'='QA status review'`, other)
		if actor != manager {
			t.Fatalf("audit actor = %s, want %s", actor, manager)
		}
	})
}

type testObjects map[string][]byte

func (objects testObjects) Put(_ context.Context, key string, reader io.Reader, _ int64, _ string) error {
	data, err := io.ReadAll(reader)
	if err == nil {
		objects[key] = data
	}
	return err
}

func (objects testObjects) Get(_ context.Context, key string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(objects[key])), nil
}

func (objects testObjects) Delete(_ context.Context, key string) error {
	delete(objects, key)
	return nil
}
