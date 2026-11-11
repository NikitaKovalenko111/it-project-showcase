package models

import "time"

type CaseDeadlineChange struct {
	ChangeID      string     `json:"change_id"`
	CaseID        string     `json:"case_id"`
	StageID       *string    `json:"stage_id"`
	RoundID       *string    `json:"round_id"`
	ChangedBy     string     `json:"changed_by"`
	PreviousDueAt *time.Time `json:"previous_due_at"`
	DueAt         time.Time  `json:"due_at"`
	Reason        string     `json:"reason"`
	ChangedAt     time.Time  `json:"changed_at"`
}

type EventPlan struct {
	Subject      string       `json:"subject"`
	TimeZone     string       `json:"time_zone"`
	VenueName    string       `json:"venue_name,omitempty"`
	Address      string       `json:"address,omitempty"`
	Building     string       `json:"building,omitempty"`
	Room         string       `json:"room,omitempty"`
	PlatformName string       `json:"platform_name,omitempty"`
	PlatformURL  string       `json:"platform_url,omitempty"`
	Regulations  string       `json:"regulations,omitempty"`
	Agenda       string       `json:"agenda,omitempty"`
	DefenseAt    *time.Time   `json:"defense_at,omitempty"`
	Rounds       []EventRound `json:"rounds"`
}

type EventRound struct {
	RoundID string      `json:"round_id,omitempty"`
	Title   string      `json:"title"`
	OpensAt time.Time   `json:"opens_at"`
	DueAt   time.Time   `json:"due_at"`
	Rules   string      `json:"rules,omitempty"`
	Tasks   []EventTask `json:"tasks"`
}

type EventTask struct {
	TaskID    string   `json:"task_id,omitempty"`
	Title     string   `json:"title"`
	Statement string   `json:"statement"`
	FileIDs   []string `json:"file_ids"`
	MaxScore  float64  `json:"max_score"`
}

type EventSolution struct {
	TaskID string `json:"task_id"`
	Text   string `json:"text,omitempty"`
	URL    string `json:"url,omitempty"`
	FileID string `json:"file_id,omitempty"`
}

type EventTaskScore struct {
	TaskID string  `json:"task_id"`
	Score  float64 `json:"score"`
}

type EventRoundSubmission struct {
	RoundID       string               `json:"round_id"`
	ExecutionID   string               `json:"execution_id"`
	SubmittedAt   time.Time            `json:"submitted_at"`
	Solutions     []EventSolution      `json:"solutions"`
	Scores        []EventTaskScore     `json:"scores"`
	TotalScore    *float64             `json:"total_score"`
	MaxScore      *float64             `json:"max_score"`
	EvaluatedAt   *time.Time           `json:"evaluated_at"`
	EvaluatorName string               `json:"evaluator_name,omitempty"`
	FileMetadata  []ResultFileMetadata `json:"file_metadata,omitempty"`
}
