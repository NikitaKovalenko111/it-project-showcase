package models

import "time"

type Comment struct {
	CommentID       string     `json:"comment_id"`
	ResourceType    string     `json:"resource_type"`
	ResourceID      string     `json:"resource_id"`
	ParentCommentID *string    `json:"parent_comment_id"`
	AuthorID        string     `json:"author_id"`
	AuthorName      string     `json:"author_name"`
	Body            string     `json:"body"`
	Status          string     `json:"status"`
	ReplyCount      int        `json:"reply_count"`
	LikesCount      int        `json:"likes_count"`
	LikedByMe       bool       `json:"liked_by_me"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at"`
}

type CommentLikeState struct {
	LikesCount int  `json:"likes_count"`
	LikedByMe  bool `json:"liked_by_me"`
}

type Report struct {
	ReportID     string     `json:"report_id"`
	ReporterID   string     `json:"reporter_id"`
	ResourceType string     `json:"resource_type"`
	ResourceID   string     `json:"resource_id"`
	Reason       string     `json:"reason"`
	Details      string     `json:"details"`
	Status       string     `json:"status"`
	Resolution   string     `json:"resolution,omitempty"`
	ModeratorID  *string    `json:"moderator_id"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	ResolvedAt   *time.Time `json:"resolved_at"`
}
