package auth_service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/models"
	session_repo "it-project-showcase/backend/internal/storage/repositories/session"
	users_repo "it-project-showcase/backend/internal/storage/repositories/user"
	"it-project-showcase/backend/pkg"

	"github.com/jackc/pgx/v5/pgconn"
)

const (
	maxFailedLoginAttempts = 5
	loginLockDuration      = 15 * time.Minute
)

var (
	ErrInvalidCredentials  = errors.New("invalid login or password")
	ErrUsernameTaken       = errors.New("username is already in use")
	ErrEmailTaken          = errors.New("email is already in use")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrAccountBlocked      = errors.New("account is blocked")
	ErrAccountLocked       = errors.New("account is temporarily locked")
	ErrUserNotFound        = errors.New("user not found")
)

type AuthService struct {
	sessionRepo *session_repo.SessionRepo
	userRepo    *users_repo.UsersRepo
	jwtConfig   config.JWT
}

func Init(sessionRepo *session_repo.SessionRepo, userRepo *users_repo.UsersRepo, jwtConfig config.JWT) *AuthService {
	return &AuthService{sessionRepo: sessionRepo, userRepo: userRepo, jwtConfig: jwtConfig}
}

func (s *AuthService) RegisterUser(ctx context.Context, input models.StudentRegistration) (string, error) {
	input.Username = strings.ToLower(strings.TrimSpace(input.Username))
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.LastName = strings.TrimSpace(input.LastName)
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.Patronymic = strings.TrimSpace(input.Patronymic)
	input.Institute = strings.TrimSpace(input.Institute)
	input.Direction = strings.TrimSpace(input.Direction)
	input.Program = strings.TrimSpace(input.Program)
	input.GroupName = strings.TrimSpace(input.GroupName)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Bio = strings.TrimSpace(input.Bio)
	input.ConsentVersion = strings.TrimSpace(input.ConsentVersion)
	input.EducationLevel = strings.TrimSpace(input.EducationLevel)
	if err := ValidateRegisterRequest(input); err != nil {
		return "", err
	}

	passwordHash, err := HashPassword(input.Password)
	if err != nil {
		return "", err
	}

	var id string
	if input.RequestedRole == "company_representative" || input.RequestedRole == "university_staff" {
		id, err = s.userRepo.RegisterRoleApplicant(ctx, input, passwordHash)
	} else {
		id, err = s.userRepo.RegisterStudent(ctx, input, passwordHash)
	}
	if err != nil {
		if conflictErr := registrationConflictError(err); conflictErr != nil {
			return "", conflictErr
		}
		return "", err
	}
	return id, nil
}

var ErrRoleAwaitingApproval = errors.New("role awaiting moderator approval")
var ErrRoleRejected = errors.New("role request rejected")

func registrationConflictError(err error) error {
	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) || pgError.Code != "23505" {
		return nil
	}
	switch pgError.ConstraintName {
	case "users_username_idx":
		return ErrUsernameTaken
	case "users_email_idx":
		return ErrEmailTaken
	default:
		return nil
	}
}

func (s *AuthService) LoginUser(ctx context.Context, login, password string) (string, string, string, error) {
	login = strings.ToLower(strings.TrimSpace(login))
	if login == "" || password == "" {
		return "", "", "", ErrInvalidCredentials
	}

	credentials, err := s.userRepo.GetUserCredentials(ctx, login)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", ErrInvalidCredentials
		}
		return "", "", "", fmt.Errorf("get user credentials: %w", err)
	}
	if credentials.Status != "active" {
		return "", "", "", ErrAccountBlocked
	}
	if credentials.LockedUntil != nil && credentials.LockedUntil.After(time.Now()) {
		return "", "", "", ErrAccountLocked
	}

	if !VerifyPassword(password, credentials.PasswordHash) {
		lockedUntil := time.Now().Add(loginLockDuration)
		if err := s.userRepo.RecordFailedLogin(ctx, credentials.UserID, maxFailedLoginAttempts, lockedUntil); err != nil {
			return "", "", "", fmt.Errorf("record failed login: %w", err)
		}
		return "", "", "", ErrInvalidCredentials
	}

	roles, err := s.userRepo.GetUserRoles(ctx, credentials.UserID)
	if err != nil {
		return "", "", "", fmt.Errorf("get user roles: %w", err)
	}
	if len(roles) == 0 {
		status, err := s.userRepo.RoleRequestStatus(ctx, credentials.UserID)
		if err != nil {
			return "", "", "", err
		}
		if status == "rejected" {
			return "", "", "", ErrRoleRejected
		}
		if status == "pending" || status == "approved" {
			return "", "", "", ErrRoleAwaitingApproval
		}
		return "", "", "", ErrAccountBlocked
	}
	if err := s.userRepo.RecordSuccessfulLogin(ctx, credentials.UserID); err != nil {
		return "", "", "", fmt.Errorf("record successful login: %w", err)
	}

	accessToken, refreshToken, refreshExpiresAt, err := s.createTokenPair(credentials.UserID, roles)
	if err != nil {
		return "", "", "", err
	}
	if err := s.sessionRepo.CreateSession(ctx, credentials.UserID, pkg.HashToken(refreshToken), refreshExpiresAt); err != nil {
		return "", "", "", fmt.Errorf("create session: %w", err)
	}
	return credentials.UserID, accessToken, refreshToken, nil
}

func (s *AuthService) RefreshTokens(ctx context.Context, currentRefreshToken string) (string, string, string, error) {
	currentRefreshToken = strings.TrimSpace(currentRefreshToken)
	claims, err := pkg.ValidateRefreshToken(currentRefreshToken, s.jwtConfig.RefreshSecret)
	if err != nil {
		return "", "", "", ErrInvalidRefreshToken
	}

	currentTokenHash := pkg.HashToken(currentRefreshToken)
	session, err := s.sessionRepo.GetActiveSessionByTokenHash(ctx, currentTokenHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", ErrInvalidRefreshToken
		}
		return "", "", "", fmt.Errorf("get active session: %w", err)
	}
	if session.UserID != claims.Subject {
		return "", "", "", ErrInvalidRefreshToken
	}

	status, err := s.userRepo.GetUserStatus(ctx, session.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", ErrAccountBlocked
		}
		return "", "", "", fmt.Errorf("get user status: %w", err)
	}
	if status != "active" {
		return "", "", "", ErrAccountBlocked
	}
	roles, err := s.userRepo.GetUserRoles(ctx, session.UserID)
	if err != nil {
		return "", "", "", fmt.Errorf("get user roles: %w", err)
	}

	accessToken, refreshToken, refreshExpiresAt, err := s.createTokenPair(session.UserID, roles)
	if err != nil {
		return "", "", "", err
	}
	newTokenHash := pkg.HashToken(refreshToken)
	if err := s.sessionRepo.RotateRefreshToken(ctx, currentTokenHash, newTokenHash, refreshExpiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", "", ErrInvalidRefreshToken
		}
		return "", "", "", fmt.Errorf("rotate refresh token: %w", err)
	}
	return session.UserID, accessToken, refreshToken, nil
}

func (s *AuthService) CurrentUser(ctx context.Context, userID string) (*models.User, error) {
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	refreshToken = strings.TrimSpace(refreshToken)
	if _, err := pkg.ValidateRefreshToken(refreshToken, s.jwtConfig.RefreshSecret); err != nil {
		return ErrInvalidRefreshToken
	}
	if err := s.sessionRepo.RevokeSessionByTokenHash(ctx, pkg.HashToken(refreshToken)); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrInvalidRefreshToken
		}
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (s *AuthService) CleanupInactiveSessions(ctx context.Context) (int64, error) {
	deleted, err := s.sessionRepo.DeleteInactiveSessions(ctx)
	if err != nil {
		return 0, fmt.Errorf("cleanup inactive sessions: %w", err)
	}
	return deleted, nil
}

func (s *AuthService) createTokenPair(userID string, roles []string) (string, string, time.Time, error) {
	accessTTL, err := time.ParseDuration(s.jwtConfig.AccessTokenTTL)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("invalid access token ttl: %w", err)
	}
	refreshTTL, err := time.ParseDuration(s.jwtConfig.RefreshTokenTTL)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("invalid refresh token ttl: %w", err)
	}
	accessToken, _, err := pkg.CreateAccessTokenWithRoles(userID, roles, s.jwtConfig.AccessSecret, accessTTL)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("create access token: %w", err)
	}
	refreshToken, expiresAt, err := pkg.CreateRefreshToken(userID, s.jwtConfig.RefreshSecret, refreshTTL)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("create refresh token: %w", err)
	}
	return accessToken, refreshToken, expiresAt, nil
}
