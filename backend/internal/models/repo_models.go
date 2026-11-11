package models

import "time"

type User struct {
	AvatarFileID *string
	UserID       string
	Username     string
	Email        string
	Status       string
	Roles        []string
	Student      *StudentProfile
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type UserCredentials struct {
	UserID           string
	Username         string
	Email            string
	PasswordHash     string
	Status           string
	FailedLoginCount int
	LockedUntil      *time.Time
}

type Session struct {
	SessionID        string
	UserID           string
	RefreshTokenHash string
	ExpiresAt        time.Time
	CreatedAt        time.Time
	RevokedAt        *time.Time
}
