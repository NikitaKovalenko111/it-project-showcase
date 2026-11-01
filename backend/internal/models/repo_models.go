package models

import "time"

type User struct {
	UserID           string
	Username         string
	Email            string
	GroupName        string
	ImageURL         string
	Status           string
	FailedLoginCount int
	LockedUntil      *time.Time
	LastLoginAt      *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
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
