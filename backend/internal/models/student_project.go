package models

import "time"

type ProjectMember struct {
	StudentID string    `json:"student_id"`
	RoleName  string    `json:"role_name"`
	JoinedAt  time.Time `json:"joined_at"`
}
type ProjectAsset struct {
	FileID  string `json:"file_id"`
	Kind    string `json:"kind"`
	Ordinal int    `json:"ordinal"`
}
type StudentProject struct {
	ProjectID         string          `json:"project_id"`
	OwnerID           string          `json:"owner_id"`
	Title             string          `json:"title"`
	Category          string          `json:"category"`
	ShortDescription  string          `json:"short_description"`
	FullDescription   string          `json:"full_description"`
	ProblemSolved     string          `json:"problem_solved,omitempty"`
	GithubURL         string          `json:"github_url,omitempty"`
	ProductURL        string          `json:"product_url,omitempty"`
	CoverFileID       *string         `json:"cover_file_id"`
	Status            string          `json:"status"`
	ModerationComment string          `json:"moderation_comment,omitempty"`
	LikesCount        int             `json:"likes_count"`
	LikedByMe         bool            `json:"liked_by_me"`
	DirectionIDs      []string        `json:"direction_ids"`
	TechnologyIDs     []string        `json:"technology_ids"`
	Members           []ProjectMember `json:"members"`
	Assets            []ProjectAsset  `json:"assets"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
	PublishedAt       *time.Time      `json:"published_at"`
}
type StudentProjectInput struct {
	Title            string          `json:"title"`
	Category         string          `json:"category"`
	ShortDescription string          `json:"short_description"`
	FullDescription  string          `json:"full_description"`
	ProblemSolved    string          `json:"problem_solved"`
	GithubURL        string          `json:"github_url"`
	ProductURL       string          `json:"product_url"`
	CoverFileID      string          `json:"cover_file_id"`
	DirectionIDs     []string        `json:"direction_ids"`
	TechnologyIDs    []string        `json:"technology_ids"`
	Members          []ProjectMember `json:"members"`
	Assets           []ProjectAsset  `json:"assets"`
}
