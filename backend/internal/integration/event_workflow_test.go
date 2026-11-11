//go:build integration

package integration

import (
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
		_, err := opportunities.UpdateInternshipStatus(ctx, manager, internship.ProgramID, "hidden", "Review", false)
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
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("X-Request-ID", "qa-workflow-request")
		response := httptest.NewRecorder()
		api.ServeHTTP(response, req)
		return response
	}

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
