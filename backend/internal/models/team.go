package models

import "time"

type TeamMember struct {
	StudentID string     `json:"student_id"`
	Name      string     `json:"name"`
	RoleID    *string    `json:"role_id"`
	RoleName  string     `json:"role_name,omitempty"`
	JoinedAt  time.Time  `json:"joined_at"`
	LeftAt    *time.Time `json:"left_at"`
}

type Team struct {
	TeamID            string       `json:"team_id"`
	Name              string       `json:"name"`
	LeaderID          string       `json:"leader_id"`
	Status            string       `json:"status"`
	Description       string       `json:"description"`
	Visibility        string       `json:"visibility"`
	LookingForMembers bool         `json:"looking_for_members"`
	Members           []TeamMember `json:"members"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
}

type TeamInvitation struct {
	TeamInvitationID string     `json:"team_invitation_id"`
	TeamID           string     `json:"team_id"`
	TeamName         string     `json:"team_name"`
	InvitedBy        string     `json:"invited_by"`
	StudentID        string     `json:"student_id"`
	RoleID           *string    `json:"role_id"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
	RespondedAt      *time.Time `json:"responded_at"`
}
