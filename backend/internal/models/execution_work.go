package models

import "time"

type EvaluationCriterion struct {
	CriterionID string  `json:"criterion_id"`
	Name        string  `json:"name"`
	MaxScore    float64 `json:"max_score"`
	Ordinal     int     `json:"ordinal"`
}
type EvaluationCriterionInput struct {
	Name     string  `json:"name"`
	MaxScore float64 `json:"max_score"`
	Ordinal  int     `json:"ordinal"`
}
type CaseStage struct {
	StageID        string     `json:"stage_id"`
	CaseID         string     `json:"case_id"`
	Ordinal        int        `json:"ordinal"`
	Title          string     `json:"title"`
	ExpectedResult string     `json:"expected_result,omitempty"`
	DueAt          *time.Time `json:"due_at"`
}
type ExecutionStage struct {
	StageID        string     `json:"stage_id"`
	Ordinal        int        `json:"ordinal"`
	Title          string     `json:"title"`
	ExpectedResult string     `json:"expected_result,omitempty"`
	DueAt          *time.Time `json:"due_at"`
	Status         string     `json:"status"`
	Feedback       string     `json:"feedback,omitempty"`
	CompletedAt    *time.Time `json:"completed_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
type ExecutionComment struct {
	CommentID   string    `json:"comment_id"`
	ExecutionID string    `json:"execution_id"`
	StageID     *string   `json:"stage_id"`
	AuthorID    string    `json:"author_id"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}
type ExecutionMentor struct {
	ExecutionID string    `json:"execution_id"`
	UserID      string    `json:"user_id"`
	RoleName    string    `json:"role_name"`
	AssignedAt  time.Time `json:"assigned_at"`
}
type NDAGrant struct {
	NDAGrantID     string     `json:"nda_grant_id"`
	CaseID         string     `json:"case_id"`
	StudentID      string     `json:"student_id"`
	Status         string     `json:"status"`
	GrantedAt      *time.Time `json:"granted_at"`
	EvidenceFileID *string    `json:"evidence_file_id"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
type CompanyInvitation struct {
	InvitationID string     `json:"invitation_id"`
	CompanyID    string     `json:"company_id"`
	StudentID    string     `json:"student_id"`
	CaseID       *string    `json:"case_id"`
	Kind         string     `json:"kind"`
	Status       string     `json:"status"`
	Message      string     `json:"message,omitempty"`
	SentAt       time.Time  `json:"sent_at"`
	RespondedAt  *time.Time `json:"responded_at"`
}

type CaseStageInput struct {
	Ordinal        int        `json:"ordinal"`
	Title          string     `json:"title"`
	ExpectedResult string     `json:"expected_result"`
	DueAt          *time.Time `json:"due_at"`
}

type CaseStageOrderInput struct {
	StageIDs []string `json:"stage_ids"`
}
