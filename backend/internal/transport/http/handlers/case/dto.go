package case_handler

import (
	"time"

	"it-project-showcase/backend/internal/models"
)

type CaseCompetencyRequest struct {
	ID            string `json:"id"`
	RequiredLevel string `json:"required_level"`
}

type PrizePlaceRequest struct {
	PlaceNo    *int     `json:"place_no"`
	Nomination string   `json:"nomination"`
	Amount     *float64 `json:"amount"`
}

type CaseRewardRequest struct {
	Kind        string              `json:"kind"`
	Description string              `json:"description"`
	Conditions  string              `json:"conditions"`
	Amount      *float64            `json:"amount"`
	Currency    string              `json:"currency"`
	PrizeFund   *float64            `json:"prize_fund"`
	PrizePlaces []PrizePlaceRequest `json:"prize_places"`
}

type CaseFileRequest struct {
	FileID     string `json:"file_id"`
	Visibility string `json:"visibility"`
}

type CaseRequest struct {
	CompanyID            string                  `json:"company_id"`
	Title                string                  `json:"title"`
	Summary              string                  `json:"summary"`
	FullBrief            string                  `json:"full_brief"`
	Type                 string                  `json:"type"`
	Difficulty           string                  `json:"difficulty"`
	WorkFormat           string                  `json:"work_format"`
	ParticipationMode    string                  `json:"participation_mode"`
	AdmissionMode        string                  `json:"admission_mode"`
	Capacity             *int                    `json:"capacity"`
	TeamSizeMin          *int                    `json:"team_size_min"`
	TeamSizeMax          *int                    `json:"team_size_max"`
	CourseMin            *int                    `json:"course_min"`
	CourseMax            *int                    `json:"course_max"`
	ApplicationDeadline  *time.Time              `json:"application_deadline"`
	DueAt                *time.Time              `json:"due_at"`
	Duration             string                  `json:"duration"`
	ResultRequirements   string                  `json:"result_requirements"`
	EvaluationRules      string                  `json:"evaluation_rules"`
	IPTerms              string                  `json:"ip_terms"`
	NDARequired          bool                    `json:"nda_required"`
	Visibility           string                  `json:"visibility"`
	DirectionIDs         []string                `json:"direction_ids"`
	RequiredCompetencies []CaseCompetencyRequest `json:"required_competencies"`
	TechnologyIDs        []string                `json:"technology_ids"`
	Rewards              []CaseRewardRequest     `json:"rewards"`
	Files                []CaseFileRequest       `json:"files"`
}

func (request CaseRequest) model() models.CaseInput {
	input := models.CaseInput{
		CompanyID: request.CompanyID, Title: request.Title, Summary: request.Summary, FullBrief: request.FullBrief,
		Type: request.Type, Difficulty: request.Difficulty, WorkFormat: request.WorkFormat,
		ParticipationMode: request.ParticipationMode, AdmissionMode: request.AdmissionMode, Capacity: request.Capacity,
		TeamSizeMin: request.TeamSizeMin, TeamSizeMax: request.TeamSizeMax, CourseMin: request.CourseMin, CourseMax: request.CourseMax,
		ApplicationDeadline: request.ApplicationDeadline, DueAt: request.DueAt, Duration: request.Duration,
		ResultRequirements: request.ResultRequirements, EvaluationRules: request.EvaluationRules, IPTerms: request.IPTerms,
		NDARequired: request.NDARequired, Visibility: request.Visibility, DirectionIDs: request.DirectionIDs, TechnologyIDs: request.TechnologyIDs,
	}
	input.Competencies = make([]models.CaseCompetencyInput, len(request.RequiredCompetencies))
	for i, value := range request.RequiredCompetencies {
		input.Competencies[i] = models.CaseCompetencyInput{ID: value.ID, RequiredLevel: value.RequiredLevel}
	}
	input.Files = make([]models.CaseFileInput, len(request.Files))
	for i, value := range request.Files {
		input.Files[i] = models.CaseFileInput{FileID: value.FileID, Visibility: value.Visibility}
	}
	input.Rewards = make([]models.CaseRewardInput, len(request.Rewards))
	for i, reward := range request.Rewards {
		converted := models.CaseRewardInput{Kind: reward.Kind, Description: reward.Description, Conditions: reward.Conditions, Amount: reward.Amount, Currency: reward.Currency, PrizeFund: reward.PrizeFund, PrizePlaces: make([]models.PrizePlaceInput, len(reward.PrizePlaces))}
		for j, place := range reward.PrizePlaces {
			converted.PrizePlaces[j] = models.PrizePlaceInput{PlaceNo: place.PlaceNo, Nomination: place.Nomination, Amount: place.Amount}
		}
		input.Rewards[i] = converted
	}
	return input
}

type ModerationRequest struct {
	Decision string `json:"decision"`
	Comment  string `json:"comment"`
}
type StatusRequest struct {
	Status string `json:"status"`
}
