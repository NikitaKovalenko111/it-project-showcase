package models

import "time"

type Application struct {
	ApplicationID  string    `json:"application_id"`
	CaseID         string    `json:"case_id"`
	CaseTitle      string    `json:"case_title"`
	CaseRevisionID string    `json:"case_revision_id"`
	CompanyID      string    `json:"company_id"`
	CompanyName    string    `json:"company_name"`
	SubmittedBy    string    `json:"submitted_by"`
	StudentID      *string   `json:"student_id"`
	TeamID         *string   `json:"team_id"`
	TeamName       string    `json:"team_name,omitempty"`
	CoverLetter    string    `json:"cover_letter,omitempty"`
	ResumeFileID   *string   `json:"resume_file_id"`
	PortfolioURL   string    `json:"portfolio_url,omitempty"`
	GithubURL      string    `json:"github_url,omitempty"`
	Status         string    `json:"status"`
	CompanyNotes   string    `json:"company_notes,omitempty"`
	ConsentCount   int       `json:"consent_count"`
	MemberCount    int       `json:"member_count"`
	ExecutionID    *string   `json:"execution_id"`
	SubmittedAt    time.Time `json:"submitted_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ApplicationInput struct {
	CaseID        string
	ApplicantType string
	TeamID        string
	CoverLetter   string
	ResumeFileID  string
	PortfolioURL  string
	GithubURL     string
}

type ApplicationListFilter struct {
	CaseID string
	Status string
	Mine   bool
}

type Execution struct {
	ExecutionID   string       `json:"execution_id"`
	CaseID        string       `json:"case_id"`
	CaseTitle     string       `json:"case_title"`
	ApplicationID string       `json:"application_id"`
	TeamID        *string      `json:"team_id"`
	Status        string       `json:"status"`
	StartedAt     *time.Time   `json:"started_at"`
	DueAt         *time.Time   `json:"due_at"`
	EndedAt       *time.Time   `json:"ended_at"`
	Members       []TeamMember `json:"members"`
	CreatedAt     time.Time    `json:"created_at"`
}
