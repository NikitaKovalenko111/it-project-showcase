package models

import "time"

type Company struct {
	CompanyID   string    `json:"company_id"`
	FullName    string    `json:"full_name"`
	ShortName   string    `json:"short_name,omitempty"`
	Industry    string    `json:"industry,omitempty"`
	Description string    `json:"description,omitempty"`
	Activities  string    `json:"activities,omitempty"`
	Website     string    `json:"website,omitempty"`
	Contacts    string    `json:"contacts,omitempty"`
	LogoFileID  *string   `json:"logo_file_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
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
