package models

import "time"

type ResultFileMetadata struct {
	FileID       string `json:"file_id"`
	OriginalName string `json:"original_name"`
	MIMEType     string `json:"mime_type"`
	SizeBytes    int64  `json:"size_bytes"`
}

type EvaluatorInfo struct {
	EvaluationID string `json:"evaluation_id"`
	Name         string `json:"name"`
}

type ResultReviewDetails struct {
	Files      []ResultFileMetadata `json:"files"`
	Evaluators []EvaluatorInfo      `json:"evaluators"`
}

type SubmissionFile struct {
	FileID  string `json:"file_id"`
	Kind    string `json:"kind"`
	Ordinal int    `json:"ordinal"`
}
type Submission struct {
	SubmissionID  string           `json:"submission_id"`
	ExecutionID   string           `json:"execution_id"`
	StageID       *string          `json:"stage_id"`
	VersionNo     int              `json:"version_no"`
	Kind          string           `json:"kind"`
	Title         string           `json:"title"`
	Description   string           `json:"description"`
	RepositoryURL string           `json:"repository_url,omitempty"`
	DemoURL       string           `json:"demo_url,omitempty"`
	Status        string           `json:"status"`
	SubmittedBy   string           `json:"submitted_by"`
	SubmittedAt   time.Time        `json:"submitted_at"`
	ReviewedAt    *time.Time       `json:"reviewed_at"`
	Files         []SubmissionFile `json:"files"`
}
type SubmissionInput struct {
	StageID       string           `json:"stage_id"`
	Kind          string           `json:"kind"`
	Title         string           `json:"title"`
	Description   string           `json:"description"`
	RepositoryURL string           `json:"repository_url"`
	DemoURL       string           `json:"demo_url"`
	Files         []SubmissionFile `json:"files"`
}
type CriterionScore struct {
	CriterionID string  `json:"criterion_id"`
	Name        string  `json:"name,omitempty"`
	Score       float64 `json:"score"`
	MaxScore    float64 `json:"max_score,omitempty"`
	Comment     string  `json:"comment,omitempty"`
}
type Evaluation struct {
	EvaluationID string           `json:"evaluation_id"`
	SubmissionID string           `json:"submission_id"`
	EvaluatorID  string           `json:"evaluator_id"`
	Status       string           `json:"status"`
	TotalScore   float64          `json:"total_score"`
	MaxScore     float64          `json:"max_score"`
	Feedback     string           `json:"feedback,omitempty"`
	Scores       []CriterionScore `json:"scores"`
	CreatedAt    time.Time        `json:"created_at"`
	PublishedAt  *time.Time       `json:"published_at"`
}
type EvaluationInput struct {
	Feedback string           `json:"feedback"`
	Scores   []CriterionScore `json:"scores"`
}
type Review struct {
	ReviewID     string    `json:"review_id"`
	SubmissionID string    `json:"submission_id"`
	AuthorID     string    `json:"author_id"`
	Decision     string    `json:"decision"`
	Body         string    `json:"body"`
	CreatedAt    time.Time `json:"created_at"`
}
type Award struct {
	AwardID           string    `json:"award_id"`
	ExecutionID       string    `json:"execution_id"`
	Title             string    `json:"title"`
	PlaceNo           *int      `json:"place_no"`
	Amount            *float64  `json:"amount"`
	Currency          *string   `json:"currency"`
	AwardedBy         string    `json:"awarded_by"`
	AwardedAt         time.Time `json:"awarded_at"`
	FulfillmentStatus string    `json:"fulfillment_status"`
	EvidenceFileID    *string   `json:"evidence_file_id"`
}
type Certificate struct {
	CertificateID    string     `json:"certificate_id"`
	ExecutionID      string     `json:"execution_id"`
	StudentID        string     `json:"student_id"`
	FileID           string     `json:"file_id"`
	VerificationCode string     `json:"verification_code"`
	IssuedBy         string     `json:"issued_by"`
	IssuedAt         time.Time  `json:"issued_at"`
	RevokedAt        *time.Time `json:"revoked_at"`
}
