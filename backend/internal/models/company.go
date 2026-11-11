package models

import "time"

type CompanyLegal struct {
	INN          string `json:"inn,omitempty"`
	KPP          string `json:"kpp,omitempty"`
	OGRN         string `json:"ogrn,omitempty"`
	LegalAddress string `json:"legal_address,omitempty"`
}

type Company struct {
	CompanyLegal
	CompanyID         string    `json:"company_id"`
	FullName          string    `json:"full_name"`
	ShortName         string    `json:"short_name,omitempty"`
	Industry          string    `json:"industry,omitempty"`
	Description       string    `json:"description,omitempty"`
	Activities        string    `json:"activities,omitempty"`
	Website           string    `json:"website,omitempty"`
	Contacts          string    `json:"contacts,omitempty"`
	InternshipProgram string    `json:"internship_program,omitempty"`
	PracticeProgram   string    `json:"practice_program,omitempty"`
	LogoFileID        *string   `json:"logo_file_id"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type CompanyInput struct {
	FullName    string
	ShortName   string
	Industry    string
	Description string
	Activities  string
	Website     string
	Contacts    string
	Position    string
}

type CompanyMemberInvitation struct {
	InvitationID string     `json:"invitation_id"`
	CompanyID    string     `json:"company_id"`
	CompanyName  string     `json:"company_name"`
	InvitedBy    string     `json:"invited_by"`
	UserID       string     `json:"user_id"`
	Position     string     `json:"position,omitempty"`
	Permissions  []string   `json:"permissions"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	RespondedAt  *time.Time `json:"responded_at"`
}
