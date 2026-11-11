package models

import "time"

type Feedback struct {
	FeedbackID  string     `json:"feedback_id"`
	AuthorID    string     `json:"author_id"`
	Body        string     `json:"body"`
	FileIDs     []string   `json:"file_ids"`
	Status      string     `json:"status"`
	ModeratorID *string    `json:"moderator_id"`
	CreatedAt   time.Time  `json:"created_at"`
	ReviewedAt  *time.Time `json:"reviewed_at"`
}
