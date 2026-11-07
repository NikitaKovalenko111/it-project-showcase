package models

import "time"

type Favorite struct {
	ResourceType string    `json:"resource_type"`
	ResourceID   string    `json:"resource_id"`
	Title        string    `json:"title"`
	CreatedAt    time.Time `json:"created_at"`
}
type Notification struct {
	NotificationID string         `json:"notification_id"`
	Type           string         `json:"type"`
	Title          string         `json:"title"`
	Body           string         `json:"body"`
	ResourceType   *string        `json:"resource_type"`
	ResourceID     *string        `json:"resource_id"`
	Metadata       map[string]any `json:"metadata"`
	CreatedAt      time.Time      `json:"created_at"`
	ReadAt         *time.Time     `json:"read_at"`
}
type AuditLog struct {
	AuditID    string         `json:"audit_id"`
	ActorID    *string        `json:"actor_id"`
	RequestID  *string        `json:"request_id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entity_type"`
	EntityID   *string        `json:"entity_id"`
	OldData    map[string]any `json:"old_data"`
	NewData    map[string]any `json:"new_data"`
	IPAddress  *string        `json:"ip_address"`
	CreatedAt  time.Time      `json:"created_at"`
}
type StudentSearchItem struct {
	UserID       string    `json:"user_id"`
	Username     string    `json:"username"`
	FullName     string    `json:"full_name"`
	Institute    string    `json:"institute"`
	Direction    string    `json:"direction"`
	Course       int       `json:"course"`
	Competencies []string  `json:"competencies"`
	Technologies []string  `json:"technologies"`
	PhotoFileID  *string   `json:"photo_file_id"`
	Rating       float64   `json:"rating"`
	CreatedAt    time.Time `json:"created_at"`
}
type Portfolio struct {
	Student      StudentSearchItem `json:"student"`
	Visibility   string            `json:"visibility"`
	Headline     string            `json:"headline,omitempty"`
	About        string            `json:"about,omitempty"`
	Projects     []StudentProject  `json:"projects"`
	Executions   []Execution       `json:"executions"`
	Certificates []Certificate     `json:"certificates"`
	Awards       []Award           `json:"awards"`
}
type Analytics struct {
	Users               int64     `json:"users"`
	ActiveStudents      int64     `json:"active_students"`
	Companies           int64     `json:"companies"`
	PublishedCases      int64     `json:"published_cases"`
	ActiveExecutions    int64     `json:"active_executions"`
	CompletedExecutions int64     `json:"completed_executions"`
	PublishedProjects   int64     `json:"published_projects"`
	Submissions         int64     `json:"submissions"`
	UpdatedAt           time.Time `json:"updated_at"`
}
type ExportRow struct {
	ID        string
	Title     string
	Status    string
	Owner     string
	CreatedAt time.Time
}
type OutboxEmail struct {
	EmailID   string
	Recipient string
	Subject   string
	Body      string
	Attempts  int
}
