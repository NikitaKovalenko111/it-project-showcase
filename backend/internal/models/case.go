package models

import "time"

type CaseCatalogItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CaseCompetency struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	RequiredLevel string `json:"required_level,omitempty"`
}

type PrizePlace struct {
	PrizePlaceID string   `json:"prize_place_id"`
	PlaceNo      *int     `json:"place_no"`
	Nomination   string   `json:"nomination,omitempty"`
	Amount       *float64 `json:"amount"`
}

type CaseReward struct {
	CaseRewardID string       `json:"case_reward_id"`
	Kind         string       `json:"kind"`
	Description  string       `json:"description"`
	Conditions   string       `json:"conditions,omitempty"`
	Amount       *float64     `json:"amount"`
	Currency     string       `json:"currency,omitempty"`
	PrizeFund    *float64     `json:"prize_fund"`
	PrizePlaces  []PrizePlace `json:"prize_places"`
}

type CaseFile struct {
	FileID       string `json:"file_id"`
	OriginalName string `json:"original_name"`
	MIMEType     string `json:"mime_type"`
	SizeBytes    int64  `json:"size_bytes"`
	Visibility   string `json:"visibility"`
}

type Case struct {
	CaseID               string            `json:"case_id"`
	CompanyID            string            `json:"company_id"`
	CompanyName          string            `json:"company_name"`
	CreatedBy            string            `json:"created_by"`
	Title                string            `json:"title"`
	Summary              string            `json:"summary"`
	FullBrief            string            `json:"full_brief"`
	Type                 string            `json:"type"`
	Difficulty           string            `json:"difficulty,omitempty"`
	WorkFormat           string            `json:"work_format"`
	ParticipationMode    string            `json:"participation_mode"`
	AdmissionMode        string            `json:"admission_mode"`
	Capacity             *int              `json:"capacity"`
	TeamSizeMin          *int              `json:"team_size_min"`
	TeamSizeMax          *int              `json:"team_size_max"`
	CourseMin            *int              `json:"course_min"`
	CourseMax            *int              `json:"course_max"`
	ApplicationDeadline  *time.Time        `json:"application_deadline"`
	DueAt                *time.Time        `json:"due_at"`
	Duration             string            `json:"duration,omitempty"`
	ResultRequirements   string            `json:"result_requirements"`
	EvaluationRules      string            `json:"evaluation_rules,omitempty"`
	IPTerms              string            `json:"ip_terms"`
	TermsVersion         int               `json:"terms_version"`
	NDARequired          bool              `json:"nda_required"`
	Status               string            `json:"status"`
	Visibility           string            `json:"visibility"`
	Directions           []CaseCatalogItem `json:"directions"`
	RequiredCompetencies []CaseCompetency  `json:"required_competencies"`
	Technologies         []CaseCatalogItem `json:"technologies"`
	Rewards              []CaseReward      `json:"rewards"`
	Files                []CaseFile        `json:"files"`
	CreatedAt            time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at"`
}

type CaseCompetencyInput struct {
	ID            string `json:"id"`
	RequiredLevel string `json:"required_level,omitempty"`
}

type PrizePlaceInput struct {
	PlaceNo    *int     `json:"place_no"`
	Nomination string   `json:"nomination,omitempty"`
	Amount     *float64 `json:"amount"`
}

type CaseRewardInput struct {
	Kind        string            `json:"kind"`
	Description string            `json:"description"`
	Conditions  string            `json:"conditions,omitempty"`
	Amount      *float64          `json:"amount"`
	Currency    string            `json:"currency,omitempty"`
	PrizeFund   *float64          `json:"prize_fund"`
	PrizePlaces []PrizePlaceInput `json:"prize_places"`
}

type CaseFileInput struct {
	FileID     string `json:"file_id"`
	Visibility string `json:"visibility"`
}

type CaseInput struct {
	CompanyID           string                `json:"company_id"`
	Title               string                `json:"title"`
	Summary             string                `json:"summary"`
	FullBrief           string                `json:"full_brief"`
	Type                string                `json:"type"`
	Difficulty          string                `json:"difficulty,omitempty"`
	WorkFormat          string                `json:"work_format"`
	ParticipationMode   string                `json:"participation_mode"`
	AdmissionMode       string                `json:"admission_mode"`
	Capacity            *int                  `json:"capacity"`
	TeamSizeMin         *int                  `json:"team_size_min"`
	TeamSizeMax         *int                  `json:"team_size_max"`
	CourseMin           *int                  `json:"course_min"`
	CourseMax           *int                  `json:"course_max"`
	ApplicationDeadline *time.Time            `json:"application_deadline"`
	DueAt               *time.Time            `json:"due_at"`
	Duration            string                `json:"duration,omitempty"`
	ResultRequirements  string                `json:"result_requirements"`
	EvaluationRules     string                `json:"evaluation_rules,omitempty"`
	IPTerms             string                `json:"ip_terms"`
	NDARequired         bool                  `json:"nda_required"`
	Visibility          string                `json:"visibility"`
	DirectionIDs        []string              `json:"direction_ids"`
	Competencies        []CaseCompetencyInput `json:"required_competencies"`
	TechnologyIDs       []string              `json:"technology_ids"`
	Rewards             []CaseRewardInput     `json:"rewards"`
	Files               []CaseFileInput       `json:"files"`
}

type CaseListFilter struct {
	Search            string
	CompanyID         string
	DirectionID       string
	Difficulty        string
	ParticipationMode string
	WorkFormat        string
	Type              string
	HasReward         *bool
	Statuses          []string
	IncludeRestricted bool
}
