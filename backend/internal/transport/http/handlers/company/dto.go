package company_handler

import "it-project-showcase/backend/internal/models"

type CompanyRequest struct {
	FullName    string `json:"full_name"`
	ShortName   string `json:"short_name"`
	Industry    string `json:"industry"`
	Description string `json:"description"`
	Activities  string `json:"activities"`
	Website     string `json:"website"`
	Contacts    string `json:"contacts"`
	Position    string `json:"position"`
}

func (r CompanyRequest) model() models.CompanyInput {
	return models.CompanyInput{FullName: r.FullName, ShortName: r.ShortName, Industry: r.Industry, Description: r.Description, Activities: r.Activities, Website: r.Website, Contacts: r.Contacts, Position: r.Position}
}

type ModerationRequest struct {
	Status  string `json:"status"`
	Comment string `json:"comment"`
}
