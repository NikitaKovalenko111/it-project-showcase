package auth_handler

import (
	"time"

	"it-project-showcase/backend/internal/models"
)

type RegisterRequest struct {
	Role                  string               `json:"role"`
	EducationLevel        string               `json:"education_level"`
	Username              string               `json:"username"`
	Email                 string               `json:"email"`
	Password              string               `json:"password"`
	LastName              string               `json:"last_name"`
	FirstName             string               `json:"first_name"`
	Patronymic            string               `json:"patronymic"`
	Institute             string               `json:"institute"`
	Direction             string               `json:"direction"`
	Program               string               `json:"program"`
	Course                int                  `json:"course"`
	GroupName             string               `json:"group_name"`
	Phone                 string               `json:"phone"`
	Bio                   string               `json:"bio"`
	ProfessionalInterests []string             `json:"professional_interests"`
	Competencies          []string             `json:"competencies"`
	Technologies          []string             `json:"technologies"`
	Links                 []models.StudentLink `json:"links"`
	ConsentVersion        string               `json:"consent_version"`
}

func (r RegisterRequest) model() models.StudentRegistration {
	return models.StudentRegistration{
		RequestedRole: r.Role, EducationLevel: r.EducationLevel,
		Username: r.Username, Email: r.Email, Password: r.Password,
		LastName: r.LastName, FirstName: r.FirstName, Patronymic: r.Patronymic,
		Institute: r.Institute, Direction: r.Direction, Program: r.Program,
		Course: r.Course, GroupName: r.GroupName, Phone: r.Phone, Bio: r.Bio,
		ProfessionalInterests: r.ProfessionalInterests, Competencies: r.Competencies,
		Technologies: r.Technologies, Links: r.Links, ConsentVersion: r.ConsentVersion,
	}
}

type RegisterResponse struct {
	UserID  string `json:"user_id"`
	Message string `json:"message"`
}
type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}
type TokenResponse struct {
	UserID       string `json:"user_id"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
}
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type MeResponse struct {
	AvatarFileID *string                `json:"avatar_file_id,omitempty"`
	UserID       string                 `json:"user_id"`
	Username     string                 `json:"username"`
	Email        string                 `json:"email"`
	Status       string                 `json:"status"`
	Roles        []string               `json:"roles"`
	Student      *models.StudentProfile `json:"student,omitempty"`
	LastLoginAt  *time.Time             `json:"last_login_at,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

func newMeResponse(user *models.User) MeResponse {
	return MeResponse{UserID: user.UserID, Username: user.Username, Email: user.Email,
		Status: user.Status, Roles: user.Roles, Student: user.Student, AvatarFileID: user.AvatarFileID,
		LastLoginAt: user.LastLoginAt, CreatedAt: user.CreatedAt, UpdatedAt: user.UpdatedAt}
}
