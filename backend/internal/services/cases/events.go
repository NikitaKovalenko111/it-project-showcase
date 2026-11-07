package cases_service

import (
	"context"
	"errors"
	"math"
	"net/url"
	"strings"
	"time"
	_ "time/tzdata"
	"unicode/utf8"

	"github.com/google/uuid"

	"it-project-showcase/backend/internal/models"
	case_repo "it-project-showcase/backend/internal/storage/repositories/case"
)

var ErrRoundWindow = errors.New("round is not open for submissions")
var ErrRoundAlreadySubmitted = errors.New("round already submitted")

func (s *Service) SetEventPlan(ctx context.Context, user, caseID string, plan models.EventPlan) error {
	if !uuidPattern.MatchString(caseID) {
		return ErrNotFound
	}
	for _, field := range []*string{&plan.Subject, &plan.TimeZone, &plan.VenueName, &plan.Address, &plan.Building, &plan.Room, &plan.PlatformName, &plan.PlatformURL, &plan.Regulations, &plan.Agenda} {
		*field = strings.TrimSpace(*field)
	}
	if _, err := time.LoadLocation(plan.TimeZone); err != nil || plan.TimeZone == "" || plan.TimeZone == "Local" {
		return ErrInvalidInput
	}
	if !textWithin(plan.Subject, 300) || len(plan.Rounds) > 20 || !optionalWebURL(plan.PlatformURL) {
		return ErrInvalidInput
	}
	for _, field := range []string{plan.VenueName, plan.Address, plan.Building, plan.Room, plan.PlatformName} {
		if utf8.RuneCountInString(field) > 500 {
			return ErrInvalidInput
		}
	}
	if utf8.RuneCountInString(plan.Regulations) > 30000 || utf8.RuneCountInString(plan.Agenda) > 30000 {
		return ErrInvalidInput
	}
	if plan.Rounds == nil {
		plan.Rounds = []models.EventRound{}
	}
	for i := range plan.Rounds {
		round := &plan.Rounds[i]
		round.Title = strings.TrimSpace(round.Title)
		if !textWithin(round.Title, 300) || round.OpensAt.IsZero() || !round.DueAt.After(round.OpensAt) ||
			utf8.RuneCountInString(round.Rules) > 10000 || len(round.Tasks) == 0 || len(round.Tasks) > 50 {
			return ErrInvalidInput
		}
		round.RoundID = uuid.NewString()
		for j := range round.Tasks {
			task := &round.Tasks[j]
			task.Title = strings.TrimSpace(task.Title)
			task.Statement = strings.TrimSpace(task.Statement)
			if !textWithin(task.Title, 300) || !textWithin(task.Statement, 30000) || !validScore(task.MaxScore) || task.MaxScore <= 0 || len(task.FileIDs) > 10 {
				return ErrInvalidInput
			}
			seen := make(map[string]struct{}, len(task.FileIDs))
			for i, file := range task.FileIDs {
				if !uniqueUUID(seen, file) {
					return ErrInvalidInput
				}
				task.FileIDs[i] = strings.ToLower(file)
			}
			task.TaskID = uuid.NewString()
		}
	}
	return mapEventError(s.repo.SetEventPlan(ctx, user, caseID, plan))
}

func (s *Service) GetEventPlan(ctx context.Context, user, caseID string, admin bool) (*models.EventPlan, error) {
	if !uuidPattern.MatchString(caseID) {
		return nil, ErrNotFound
	}
	plan, err := s.repo.GetEventPlan(ctx, user, caseID, admin)
	return plan, mapEventError(err)
}

func (s *Service) SubmitEventRound(ctx context.Context, user, execution, round string, solutions []models.EventSolution) error {
	if !uuidPattern.MatchString(execution) || !uuidPattern.MatchString(round) || len(solutions) == 0 || len(solutions) > 50 {
		return ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(solutions))
	for i := range solutions {
		item := &solutions[i]
		item.TaskID = strings.ToLower(item.TaskID)
		item.Text = strings.TrimSpace(item.Text)
		item.URL = strings.TrimSpace(item.URL)
		if !uniqueUUID(seen, item.TaskID) || utf8.RuneCountInString(item.Text) > 30000 || !optionalWebURL(item.URL) ||
			(item.FileID != "" && !uuidPattern.MatchString(item.FileID)) || (item.Text == "" && item.URL == "" && item.FileID == "") {
			return ErrInvalidInput
		}
		item.FileID = strings.ToLower(item.FileID)
	}
	return mapEventError(s.repo.SubmitEventRound(ctx, user, execution, strings.ToLower(round), solutions))
}

func (s *Service) GradeEventRound(ctx context.Context, user, execution, round string, admin bool, scores []models.EventTaskScore) error {
	if !uuidPattern.MatchString(execution) || !uuidPattern.MatchString(round) || len(scores) == 0 || len(scores) > 50 {
		return ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(scores))
	for i := range scores {
		item := &scores[i]
		item.TaskID = strings.ToLower(item.TaskID)
		if !uniqueUUID(seen, item.TaskID) || !validScore(item.Score) {
			return ErrInvalidInput
		}
	}
	return mapEventError(s.repo.GradeEventRound(ctx, user, execution, strings.ToLower(round), admin, scores))
}

func (s *Service) ListEventRoundSubmissions(ctx context.Context, user, execution string, admin bool) ([]models.EventRoundSubmission, error) {
	if !uuidPattern.MatchString(execution) {
		return nil, ErrNotFound
	}
	items, err := s.repo.ListEventRoundSubmissions(ctx, user, execution, admin)
	return items, mapEventError(err)
}

func textWithin(value string, limit int) bool {
	return value != "" && utf8.RuneCountInString(value) <= limit
}
func validScore(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0 && value <= 1000000
}
func optionalWebURL(value string) bool {
	if value == "" {
		return true
	}
	u, err := url.ParseRequestURI(value)
	return len(value) <= 2000 && err == nil && u.Host != "" && (u.Scheme == "http" || u.Scheme == "https")
}
func mapEventError(err error) error {
	switch {
	case errors.Is(err, case_repo.ErrRoundWindow):
		return ErrRoundWindow
	case errors.Is(err, case_repo.ErrRoundAlreadySubmitted):
		return ErrRoundAlreadySubmitted
	case errors.Is(err, case_repo.ErrRoundData):
		return ErrInvalidInput
	default:
		return mapRepositoryError(err)
	}
}
