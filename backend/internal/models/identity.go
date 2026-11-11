package models

type StudentRegistration struct {
	RequestedRole         string
	EducationLevel        string
	Username              string
	Email                 string
	Password              string
	LastName              string
	FirstName             string
	Patronymic            string
	Institute             string
	Direction             string
	Program               string
	Course                int
	GroupName             string
	Phone                 string
	Bio                   string
	ProfessionalInterests []string
	Competencies          []string
	Technologies          []string
	Links                 []StudentLink
	ConsentVersion        string
}

type StudentLink struct {
	Kind string `json:"kind"`
	URL  string `json:"url"`
}

type StudentProfile struct {
	LastName              string        `json:"last_name"`
	FirstName             string        `json:"first_name"`
	Patronymic            string        `json:"patronymic,omitempty"`
	Institute             string        `json:"institute"`
	Direction             string        `json:"direction"`
	Program               string        `json:"program,omitempty"`
	EducationLevel        string        `json:"education_level,omitempty"`
	Course                int           `json:"course"`
	GroupName             string        `json:"group_name"`
	Phone                 string        `json:"phone,omitempty"`
	Bio                   string        `json:"bio,omitempty"`
	ProfessionalInterests []string      `json:"professional_interests"`
	Competencies          []string      `json:"competencies"`
	Technologies          []string      `json:"technologies"`
	Links                 []StudentLink `json:"links"`
	PhotoFileID           *string       `json:"photo_file_id"`
}

type StudentProfileUpdate struct {
	StudentProfile
	Email string `json:"email"`
}

type UserListItem struct {
	UserID            string   `json:"user_id"`
	Username          string   `json:"username"`
	Email             string   `json:"email"`
	Status            string   `json:"status"`
	Roles             []string `json:"roles"`
	RequestedRole     *string  `json:"requested_role"`
	RoleRequestStatus *string  `json:"role_request_status"`
}
