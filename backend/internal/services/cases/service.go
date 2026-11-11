package cases_service

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"it-project-showcase/backend/internal/models"
	case_repo "it-project-showcase/backend/internal/storage/repositories/case"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrNotFound          = errors.New("case not found")
	ErrForbidden         = errors.New("case access denied")
	ErrInvalidInput      = errors.New("invalid case input")
	ErrInvalidFilter     = errors.New("invalid case filter")
	ErrInvalidCursor     = errors.New("invalid case cursor")
	ErrDeadlineExpired   = case_repo.ErrDeadlineExpired
	ErrInvalidTransition = errors.New("invalid case status transition")
	ErrReferenceNotFound = errors.New("case reference not found")
	ErrStagesLocked      = errors.New("case stages are locked by existing executions")
	ErrEventPlanRequired = errors.New("event plan and deadlines are required")
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type Service struct{ repo *case_repo.Repository }

func Init(repo *case_repo.Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context, filter models.CaseListFilter, limit int, position, id string) ([]models.Case, error) {
	filter.Statuses = []string{"published", "in_progress", "completed"}
	if err := validateFilter(filter); err != nil {
		return nil, err
	}
	before, err := parseCursor(position, id)
	if err != nil {
		return nil, err
	}
	return s.repo.List(ctx, filter, limit, before, id)
}

func (s *Service) ListForModeration(ctx context.Context, filter models.CaseListFilter, status string, limit int, position, id string) ([]models.Case, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		status = "moderation"
	}
	if !oneOf(status, "draft", "moderation", "revision", "published", "in_progress", "completed", "cancelled", "hidden") {
		return nil, ErrInvalidFilter
	}
	filter.Statuses = []string{status}
	filter.IncludeRestricted = true
	if err := validateFilter(filter); err != nil {
		return nil, err
	}
	before, err := parseCursor(position, id)
	if err != nil {
		return nil, err
	}
	return s.repo.List(ctx, filter, limit, before, id)
}

func (s *Service) ListMine(ctx context.Context, userID string, filter models.CaseListFilter, limit int, position, id string) ([]models.Case, error) {
	filter.ManagerID, filter.IncludeRestricted = userID, true
	filter.Statuses = []string{"draft", "moderation", "revision", "published", "in_progress", "completed", "cancelled", "hidden"}
	if err := validateFilter(filter); err != nil {
		return nil, err
	}
	before, err := parseCursor(position, id)
	if err != nil {
		return nil, err
	}
	return s.repo.List(ctx, filter, limit, before, id)
}

func (s *Service) Get(ctx context.Context, caseID string) (*models.Case, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	item, err := s.repo.GetPublic(ctx, caseID)
	return item, mapRepositoryError(err)
}

func (s *Service) RecordView(ctx context.Context, caseID, userID string) error {
	if !uuidPattern.MatchString(caseID) {
		return ErrNotFound
	}
	return mapRepositoryError(s.repo.RecordView(ctx, caseID, userID))
}

func (s *Service) GetManaged(ctx context.Context, userID, caseID string, admin bool) (*models.Case, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	item, err := s.repo.GetManaged(ctx, userID, caseID, admin)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	return item, mapRepositoryError(err)
}

func (s *Service) Create(ctx context.Context, userID string, input models.CaseInput) (*models.Case, error) {
	input = normalize(input)
	if input.DueAt != nil && !input.DueAt.After(time.Now()) {
		return nil, ErrDeadlineExpired
	}
	if input.Capacity == nil || input.TeamSizeMin == nil || input.TeamSizeMax == nil {
		return nil, ErrInvalidInput
	}
	if err := validate(input); err != nil {
		return nil, err
	}
	item, err := s.repo.Create(ctx, userID, input)
	return item, mapRepositoryError(err)
}

func (s *Service) ChangeDeadline(ctx context.Context, actor, caseID, stageID, roundID string, dueAt time.Time, reason string) error {
	reason = strings.TrimSpace(reason)
	if !uuidPattern.MatchString(caseID) || (stageID != "" && !uuidPattern.MatchString(stageID)) ||
		(roundID != "" && !uuidPattern.MatchString(roundID)) {
		return ErrNotFound
	}
	if !dueAt.After(time.Now()) || reason == "" || utf8.RuneCountInString(reason) > 1000 {
		return ErrInvalidInput
	}
	return mapEventError(s.repo.ChangeDeadline(ctx, actor, caseID, stageID, strings.ToLower(roundID), dueAt, reason))
}

func (s *Service) ListDeadlineChanges(ctx context.Context, user, caseID string, admin bool, limit int, offset int64) ([]models.CaseDeadlineChange, int64, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, 0, ErrNotFound
	}
	items, total, err := s.repo.ListDeadlineChanges(ctx, user, caseID, admin, limit, offset)
	return items, total, mapRepositoryError(err)
}

func (s *Service) Update(ctx context.Context, userID, caseID string, input models.CaseInput) (*models.Case, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	input = normalize(input)
	if err := validate(input); err != nil {
		return nil, err
	}
	item, err := s.repo.Update(ctx, userID, caseID, input)
	return item, mapRepositoryError(err)
}

func (s *Service) SubmitForModeration(ctx context.Context, userID, caseID string) (*models.Case, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	item, err := s.repo.SubmitForModeration(ctx, userID, caseID)
	return item, mapRepositoryError(err)
}

func (s *Service) Cancel(ctx context.Context, userID, caseID string) (*models.Case, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	item, err := s.repo.Cancel(ctx, userID, caseID)
	return item, mapRepositoryError(err)
}

func (s *Service) Moderate(ctx context.Context, moderatorID, caseID, decision, comment string) (*models.Case, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	decision, comment = strings.TrimSpace(decision), strings.TrimSpace(comment)
	if !oneOf(decision, "approve", "request_revision", "reject", "hide") || utf8.RuneCountInString(comment) > 2000 || ((decision == "request_revision" || decision == "reject") && comment == "") {
		return nil, ErrInvalidInput
	}
	item, err := s.repo.Moderate(ctx, moderatorID, caseID, decision, comment)
	return item, mapRepositoryError(err)
}

func parseCursor(position, id string) (*time.Time, error) {
	if position == "" {
		return nil, nil
	}
	value, err := time.Parse(time.RFC3339Nano, position)
	if err != nil || !uuidPattern.MatchString(id) {
		return nil, ErrInvalidCursor
	}
	return &value, nil
}

func validateFilter(filter models.CaseListFilter) error {
	if utf8.RuneCountInString(filter.Search) > 200 {
		return ErrInvalidFilter
	}
	for _, value := range []string{filter.CompanyID, filter.DirectionID} {
		if value != "" && !uuidPattern.MatchString(value) {
			return ErrInvalidFilter
		}
	}
	if filter.Difficulty != "" && !oneOf(filter.Difficulty, "beginner", "intermediate", "advanced") {
		return ErrInvalidFilter
	}
	if filter.ParticipationMode != "" && !oneOf(filter.ParticipationMode, "individual", "team", "both") {
		return ErrInvalidFilter
	}
	if filter.WorkFormat != "" && !oneOf(filter.WorkFormat, "remote", "onsite", "hybrid") {
		return ErrInvalidFilter
	}
	if filter.Type != "" && !oneOf(filter.Type, "educational", "contest", "paid", "other_reward") {
		return ErrInvalidFilter
	}
	if filter.EventFormat != "" && !oneOf(filter.EventFormat, "case", "hackathon", "olympiad") {
		return ErrInvalidFilter
	}
	return nil
}

func normalize(input models.CaseInput) models.CaseInput {
	input.CompanyID = strings.TrimSpace(input.CompanyID)
	input.Title = strings.TrimSpace(input.Title)
	input.Summary = strings.TrimSpace(input.Summary)
	input.FullBrief = strings.TrimSpace(input.FullBrief)
	input.Type = strings.TrimSpace(input.Type)
	input.EventFormat = strings.TrimSpace(input.EventFormat)
	if input.EventFormat == "" {
		input.EventFormat = "case"
	}
	input.Difficulty = strings.TrimSpace(input.Difficulty)
	input.WorkFormat = strings.TrimSpace(input.WorkFormat)
	input.ParticipationMode = strings.TrimSpace(input.ParticipationMode)
	input.AdmissionMode = strings.TrimSpace(input.AdmissionMode)
	input.Duration = strings.TrimSpace(input.Duration)
	input.ResultRequirements = strings.TrimSpace(input.ResultRequirements)
	input.EvaluationRules = strings.TrimSpace(input.EvaluationRules)
	input.IPTerms = strings.TrimSpace(input.IPTerms)
	input.Visibility = strings.TrimSpace(input.Visibility)
	for i := range input.DirectionIDs {
		input.DirectionIDs[i] = strings.TrimSpace(input.DirectionIDs[i])
	}
	for i := range input.TechnologyIDs {
		input.TechnologyIDs[i] = strings.TrimSpace(input.TechnologyIDs[i])
	}
	for i := range input.Competencies {
		input.Competencies[i].ID = strings.TrimSpace(input.Competencies[i].ID)
		input.Competencies[i].RequiredLevel = strings.TrimSpace(input.Competencies[i].RequiredLevel)
	}
	for i := range input.Files {
		input.Files[i].FileID = strings.TrimSpace(input.Files[i].FileID)
		input.Files[i].Visibility = strings.TrimSpace(input.Files[i].Visibility)
		if input.Files[i].Visibility == "" {
			input.Files[i].Visibility = "public"
		}
	}
	for i := range input.Rewards {
		input.Rewards[i].Kind = strings.TrimSpace(input.Rewards[i].Kind)
		input.Rewards[i].Description = strings.TrimSpace(input.Rewards[i].Description)
		input.Rewards[i].Conditions = strings.TrimSpace(input.Rewards[i].Conditions)
		input.Rewards[i].Currency = strings.ToUpper(strings.TrimSpace(input.Rewards[i].Currency))
		for j := range input.Rewards[i].PrizePlaces {
			input.Rewards[i].PrizePlaces[j].Nomination = strings.TrimSpace(input.Rewards[i].PrizePlaces[j].Nomination)
		}
	}
	return input
}

func validate(input models.CaseInput) error {
	if !uuidPattern.MatchString(input.CompanyID) || input.Title == "" || input.Summary == "" || input.FullBrief == "" || input.ResultRequirements == "" || input.IPTerms == "" {
		return ErrInvalidInput
	}
	if utf8.RuneCountInString(input.Title) > 300 || utf8.RuneCountInString(input.Summary) > 1000 || utf8.RuneCountInString(input.FullBrief) > 30000 || utf8.RuneCountInString(input.ResultRequirements) > 10000 || utf8.RuneCountInString(input.EvaluationRules) > 10000 || utf8.RuneCountInString(input.IPTerms) > 10000 || utf8.RuneCountInString(input.Duration) > 200 {
		return ErrInvalidInput
	}
	if !oneOf(input.Type, "educational", "contest", "paid", "other_reward") || !oneOf(input.EventFormat, "case", "hackathon", "olympiad") || (input.Difficulty != "" && !oneOf(input.Difficulty, "beginner", "intermediate", "advanced")) || !oneOf(input.WorkFormat, "remote", "onsite", "hybrid") || !oneOf(input.ParticipationMode, "individual", "team", "both") || !oneOf(input.AdmissionMode, "open", "selection", "test", "invitation") || !oneOf(input.Visibility, "public", "restricted") {
		return ErrInvalidInput
	}
	if !validRange(input.TeamSizeMin, input.TeamSizeMax, 1, 100) || !validRange(input.CourseMin, input.CourseMax, 1, 8) || (input.Capacity != nil && (*input.Capacity < 1 || *input.Capacity > 10000)) {
		return ErrInvalidInput
	}
	if input.TeamSizeMin != nil && input.TeamSizeMax != nil {
		individual := *input.TeamSizeMin == 1 && *input.TeamSizeMax == 1
		if individual != (input.ParticipationMode == "individual") {
			return ErrInvalidInput
		}
	}
	if input.ApplicationDeadline != nil && input.DueAt != nil && input.ApplicationDeadline.After(*input.DueAt) {
		return ErrInvalidInput
	}
	seenDirections, seenTechnologies, seenCompetencies, seenFiles := map[string]struct{}{}, map[string]struct{}{}, map[string]struct{}{}, map[string]struct{}{}
	for _, id := range input.DirectionIDs {
		if !uniqueUUID(seenDirections, id) {
			return ErrInvalidInput
		}
	}
	for _, id := range input.TechnologyIDs {
		if !uniqueUUID(seenTechnologies, id) {
			return ErrInvalidInput
		}
	}
	for _, value := range input.Competencies {
		if !uniqueUUID(seenCompetencies, value.ID) || utf8.RuneCountInString(value.RequiredLevel) > 100 {
			return ErrInvalidInput
		}
	}
	for _, value := range input.Files {
		if !uniqueUUID(seenFiles, value.FileID) || !oneOf(value.Visibility, "public", "participants", "company") {
			return ErrInvalidInput
		}
	}
	if len(input.DirectionIDs) > 50 || len(input.Competencies) > 100 || len(input.TechnologyIDs) > 100 || len(input.Files) > 50 || len(input.Rewards) > 20 {
		return ErrInvalidInput
	}
	if len(input.EvaluationCriteria) > 50 {
		return ErrInvalidInput
	}
	ordinals := map[int]struct{}{}
	for _, criterion := range input.EvaluationCriteria {
		if strings.TrimSpace(criterion.Name) == "" || utf8.RuneCountInString(criterion.Name) > 300 || criterion.MaxScore <= 0 || criterion.Ordinal < 1 {
			return ErrInvalidInput
		}
		if _, exists := ordinals[criterion.Ordinal]; exists {
			return ErrInvalidInput
		}
		ordinals[criterion.Ordinal] = struct{}{}
	}
	for _, reward := range input.Rewards {
		if !oneOf(reward.Kind, "money", "prize", "internship", "interview", "job", "training", "gift", "certificate", "other") || reward.Description == "" || utf8.RuneCountInString(reward.Description) > 2000 || utf8.RuneCountInString(reward.Conditions) > 3000 || (reward.Amount != nil && *reward.Amount < 0) || (reward.PrizeFund != nil && *reward.PrizeFund < 0) || ((reward.Amount != nil || reward.PrizeFund != nil) && !regexp.MustCompile(`^[A-Z]{3}$`).MatchString(reward.Currency)) || len(reward.PrizePlaces) > 100 {
			return ErrInvalidInput
		}
		for _, place := range reward.PrizePlaces {
			if (place.PlaceNo == nil && place.Nomination == "") || (place.PlaceNo != nil && *place.PlaceNo < 1) || (place.Amount != nil && *place.Amount < 0) || utf8.RuneCountInString(place.Nomination) > 300 {
				return ErrInvalidInput
			}
		}
	}
	return nil
}

func validRange(minimum, maximum *int, low, high int) bool {
	if minimum != nil && (*minimum < low || *minimum > high) {
		return false
	}
	if maximum != nil && (*maximum < low || *maximum > high) {
		return false
	}
	return minimum == nil || maximum == nil || *minimum <= *maximum
}
func uniqueUUID(seen map[string]struct{}, value string) bool {
	if !uuidPattern.MatchString(value) {
		return false
	}
	key := strings.ToLower(value)
	if _, ok := seen[key]; ok {
		return false
	}
	seen[key] = struct{}{}
	return true
}
func oneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}

func mapRepositoryError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if errors.Is(err, case_repo.ErrAccessDenied) {
		return ErrForbidden
	}
	if errors.Is(err, case_repo.ErrInvalidTransition) {
		return ErrInvalidTransition
	}
	if errors.Is(err, case_repo.ErrReferenceNotFound) {
		return ErrReferenceNotFound
	}
	if errors.Is(err, case_repo.ErrStagesLocked) {
		return ErrStagesLocked
	}
	if errors.Is(err, case_repo.ErrEventPlanRequired) {
		return ErrEventPlanRequired
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "23503" || pgErr.Code == "23514" || pgErr.Code == "23505") {
		return ErrInvalidInput
	}
	return err
}
func (s *Service) ListStages(ctx context.Context, caseID, userID string, public, admin bool) ([]models.CaseStage, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	x, err := s.repo.ListStages(ctx, caseID, public, userID, admin)
	return x, mapRepositoryError(err)
}
func (s *Service) DeleteStage(ctx context.Context, userID, caseID, stageID string) error {
	if !uuidPattern.MatchString(caseID) || !uuidPattern.MatchString(stageID) {
		return ErrNotFound
	}
	return mapRepositoryError(s.repo.DeleteStage(ctx, userID, caseID, stageID))
}
func (s *Service) CreateStage(ctx context.Context, userID, caseID string, input models.CaseStageInput) (*models.CaseStage, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.ExpectedResult = strings.TrimSpace(input.ExpectedResult)
	if !uuidPattern.MatchString(caseID) || input.Ordinal < 1 || input.Title == "" || utf8.RuneCountInString(input.Title) > 300 || utf8.RuneCountInString(input.ExpectedResult) > 3000 {
		return nil, ErrInvalidInput
	}
	x, err := s.repo.CreateStage(ctx, userID, caseID, input)
	return x, mapRepositoryError(err)
}

func (s *Service) UpdateStage(ctx context.Context, userID, caseID, stageID string, input models.CaseStageInput) (*models.CaseStage, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.ExpectedResult = strings.TrimSpace(input.ExpectedResult)
	if !uuidPattern.MatchString(caseID) || !uuidPattern.MatchString(stageID) || input.Ordinal < 1 || input.Title == "" || utf8.RuneCountInString(input.Title) > 300 || utf8.RuneCountInString(input.ExpectedResult) > 3000 {
		return nil, ErrInvalidInput
	}
	x, err := s.repo.UpdateStage(ctx, userID, caseID, stageID, input)
	return x, mapRepositoryError(err)
}

func (s *Service) ReorderStages(ctx context.Context, userID, caseID string, stageIDs []string) ([]models.CaseStage, error) {
	if !uuidPattern.MatchString(caseID) || len(stageIDs) == 0 || len(stageIDs) > 100 {
		return nil, ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(stageIDs))
	for i, stageID := range stageIDs {
		if !uuidPattern.MatchString(stageID) {
			return nil, ErrInvalidInput
		}
		stageID = strings.ToLower(stageID)
		if _, exists := seen[stageID]; exists {
			return nil, ErrInvalidInput
		}
		seen[stageID] = struct{}{}
		stageIDs[i] = stageID
	}
	x, err := s.repo.ReorderStages(ctx, userID, caseID, stageIDs)
	return x, mapRepositoryError(err)
}

func (s *Service) SavePlan(ctx context.Context, userID, caseID string, input models.CasePlanUpdate) ([]models.CaseStage, error) {
	input.Reason = strings.TrimSpace(input.Reason)
	if !uuidPattern.MatchString(caseID) || input.Stages == nil || input.Previous == nil ||
		len(input.Stages) > 100 || len(input.Previous) > 100 || utf8.RuneCountInString(input.Reason) > 1000 {
		return nil, ErrInvalidInput
	}
	seen := make(map[string]struct{})
	for i := range input.Stages {
		stage := &input.Stages[i]
		stage.StageID = strings.ToLower(stage.StageID)
		stage.Title = strings.TrimSpace(stage.Title)
		stage.ExpectedResult = strings.TrimSpace(stage.ExpectedResult)
		if stage.DueAt != nil {
			dueAt := stage.DueAt.Truncate(time.Microsecond)
			stage.DueAt = &dueAt
		}
		if stage.Title == "" || utf8.RuneCountInString(stage.Title) > 300 ||
			utf8.RuneCountInString(stage.ExpectedResult) > 3000 ||
			(stage.StageID != "" && !uniqueUUID(seen, stage.StageID)) {
			return nil, ErrInvalidInput
		}
	}
	stages, err := s.repo.SavePlan(ctx, userID, caseID, input)
	if errors.Is(err, case_repo.ErrPlanChanged) || errors.Is(err, case_repo.ErrPlanDeadline) {
		return nil, err
	}
	return stages, mapRepositoryError(err)
}
