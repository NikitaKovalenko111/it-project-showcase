package models

import "time"

type TeamJoinApplication struct {
	JoinApplicationID string     `json:"join_application_id"`
	TeamID            string     `json:"team_id"`
	StudentID         string     `json:"student_id"`
	StudentName       string     `json:"student_name"`
	RoleID            *string    `json:"role_id"`
	ResumeFileID      *string    `json:"resume_file_id"`
	CoverLetter       string     `json:"cover_letter"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
	RespondedAt       *time.Time `json:"responded_at"`
}
type TeamSearchProfile struct {
	StudentID    string    `json:"student_id"`
	Headline     string    `json:"headline"`
	Description  string    `json:"description"`
	ResumeFileID *string   `json:"resume_file_id"`
	IsVisible    bool      `json:"is_visible"`
	UpdatedAt    time.Time `json:"updated_at"`
}
type InternshipProgram struct {
	Capacity            *int       `json:"capacity"`
	ProgramID           string     `json:"program_id"`
	CompanyID           string     `json:"company_id"`
	CompanyName         string     `json:"company_name"`
	CreatedBy           string     `json:"created_by"`
	Title               string     `json:"title"`
	Summary             string     `json:"summary"`
	ContentMarkdown     string     `json:"content_markdown"`
	Status              string     `json:"status"`
	ModerationComment   string     `json:"moderation_comment,omitempty"`
	ApplicationDeadline *time.Time `json:"application_deadline"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	PublishedAt         *time.Time `json:"published_at"`
}
type InternshipInput struct {
	Capacity            *int       `json:"capacity"`
	CompanyID           string     `json:"company_id"`
	Title               string     `json:"title"`
	Summary             string     `json:"summary"`
	ContentMarkdown     string     `json:"content_markdown"`
	ApplicationDeadline *time.Time `json:"application_deadline"`
}

type InternshipApplication struct {
	ApplicationID string     `json:"application_id"`
	ProgramID     string     `json:"program_id"`
	StudentID     string     `json:"student_id"`
	CoverLetter   string     `json:"cover_letter"`
	ResumeFileID  *string    `json:"resume_file_id"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"created_at"`
	DecidedAt     *time.Time `json:"decided_at"`
}
type LeaderboardEntry struct {
	PlaceNo          *int    `json:"place_no"`
	Nomination       string  `json:"nomination,omitempty"`
	ExecutionID      string  `json:"execution_id"`
	TeamID           *string `json:"team_id"`
	TeamName         string  `json:"team_name,omitempty"`
	TotalScore       float64 `json:"total_score"`
	MaxScore         float64 `json:"max_score"`
	Percentage       float64 `json:"percentage"`
	EvaluationStatus string  `json:"evaluation_status"`
}
type PlacementInput struct {
	ExecutionID string `json:"execution_id"`
	PlaceNo     *int   `json:"place_no"`
	Nomination  string `json:"nomination"`
}
type CuratorAssignment struct {
	StudentID   string    `json:"student_id"`
	CuratorID   string    `json:"curator_id"`
	CuratorName string    `json:"curator_name"`
	AssignedBy  string    `json:"assigned_by"`
	AssignedAt  time.Time `json:"assigned_at"`
}
type PortfolioFile struct {
	FileID       string    `json:"file_id"`
	Kind         string    `json:"kind"`
	IsDefault    bool      `json:"is_default"`
	Visibility   string    `json:"visibility"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    time.Time `json:"created_at"`
}
type ApplicationDefaults struct {
	GithubURL        string   `json:"github_url,omitempty"`
	ResumeFileID     *string  `json:"resume_file_id"`
	PortfolioFileIDs []string `json:"portfolio_file_ids"`
}
type StudentRating struct {
	StudentID        string  `json:"student_id"`
	Rating           float64 `json:"rating"`
	QualityScore     float64 `json:"quality_score"`
	CompletionScore  float64 `json:"completion_score"`
	ProjectScore     float64 `json:"project_score"`
	AchievementScore float64 `json:"achievement_score"`
}
type NDAVersion struct {
	NDAVersionID string    `json:"nda_version_id"`
	CaseID       string    `json:"case_id"`
	VersionNo    int       `json:"version_no"`
	Text         string    `json:"text"`
	FileID       *string   `json:"file_id"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	IsCurrent    bool      `json:"is_current"`
}
