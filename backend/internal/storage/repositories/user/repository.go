package users_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"it-project-showcase/backend/internal/models"
)

type UsersRepo struct {
	db *sql.DB
}

func Init(db *sql.DB) *UsersRepo {
	return &UsersRepo{db: db}
}

func (r *UsersRepo) RegisterStudent(ctx context.Context, input models.StudentRegistration, passwordHash string) (string, error) {
	if input.ProfessionalInterests == nil {
		input.ProfessionalInterests = []string{}
	}
	if input.Competencies == nil {
		input.Competencies = []string{}
	}
	if input.Technologies == nil {
		input.Technologies = []string{}
	}
	if input.Links == nil {
		input.Links = []models.StudentLink{}
	}
	interests, err := json.Marshal(input.ProfessionalInterests)
	if err != nil {
		return "", fmt.Errorf("encode professional interests: %w", err)
	}
	competencies, err := json.Marshal(input.Competencies)
	if err != nil {
		return "", fmt.Errorf("encode competencies: %w", err)
	}
	technologies, err := json.Marshal(input.Technologies)
	if err != nil {
		return "", fmt.Errorf("encode technologies: %w", err)
	}
	links, err := json.Marshal(input.Links)
	if err != nil {
		return "", fmt.Errorf("encode links: %w", err)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin student registration: %w", err)
	}
	defer tx.Rollback()

	var userID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (username, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING user_id
	`, input.Username, input.Email, passwordHash).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("create user: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO students (
			user_id, last_name, first_name, patronymic, institute_name,
			study_direction, program_name, course, group_name, phone, bio,
			professional_interests, competencies, technologies, links
		)
		VALUES (
			$1, $2, $3, NULLIF($4, ''), $5,
			$6, NULLIF($7, ''), $8, $9, NULLIF($10, ''), NULLIF($11, ''),
			$12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb
		)
	`,
		userID, input.LastName, input.FirstName, input.Patronymic, input.Institute,
		input.Direction, input.Program, input.Course, input.GroupName, input.Phone, input.Bio,
		string(interests), string(competencies), string(technologies), string(links),
	)
	if err != nil {
		return "", fmt.Errorf("create student profile: %w", err)
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		SELECT $1, role_id FROM roles WHERE code = 'student'
	`, userID)
	if err != nil {
		return "", fmt.Errorf("assign student role: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return "", fmt.Errorf("read assigned role count: %w", err)
	}
	if rowsAffected != 1 {
		return "", errors.New("student role is not configured")
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO user_consents (user_id, consent_type, version)
		VALUES ($1, 'personal_data', $2)
	`, userID, input.ConsentVersion)
	if err != nil {
		return "", fmt.Errorf("record personal data consent: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit student registration: %w", err)
	}

	return userID, nil
}

func (r *UsersRepo) GetUserCredentials(ctx context.Context, login string) (*models.UserCredentials, error) {
	var credentials models.UserCredentials
	err := r.db.QueryRowContext(ctx, `
		SELECT user_id, username, email, password_hash, status, failed_login_count, locked_until
		FROM users
		WHERE email = $1 OR username = $1
		LIMIT 1
	`, login).Scan(
		&credentials.UserID,
		&credentials.Username,
		&credentials.Email,
		&credentials.PasswordHash,
		&credentials.Status,
		&credentials.FailedLoginCount,
		&credentials.LockedUntil,
	)
	if err != nil {
		return nil, fmt.Errorf("select user credentials: %w", err)
	}
	return &credentials, nil
}

func (r *UsersRepo) GetUserStatus(ctx context.Context, userID string) (string, error) {
	var status string
	if err := r.db.QueryRowContext(ctx, `SELECT status FROM users WHERE user_id = $1`, userID).Scan(&status); err != nil {
		return "", fmt.Errorf("select user status: %w", err)
	}
	return status, nil
}

func (r *UsersRepo) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	var user models.User
	var profile models.StudentProfile
	var interests, competencies, technologies, links []byte

	err := r.db.QueryRowContext(ctx, `
		SELECT
			u.user_id, u.username, u.email, u.status, u.last_login_at, u.created_at, u.updated_at,
			COALESCE(s.last_name, ''), COALESCE(s.first_name, ''), COALESCE(s.patronymic, ''),
			COALESCE(s.institute_name, ''), COALESCE(s.study_direction, ''), COALESCE(s.program_name, ''),
			COALESCE(s.course, 0), COALESCE(s.group_name, ''), COALESCE(s.phone, ''), COALESCE(s.bio, ''),
			COALESCE(s.professional_interests, '[]'::jsonb),
			COALESCE(s.competencies, '[]'::jsonb),
			COALESCE(s.technologies, '[]'::jsonb),
			COALESCE(s.links, '[]'::jsonb), s.photo_file_id
		FROM users u
		LEFT JOIN students s ON s.user_id = u.user_id
		WHERE u.user_id = $1
	`, userID).Scan(
		&user.UserID, &user.Username, &user.Email, &user.Status, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
		&profile.LastName, &profile.FirstName, &profile.Patronymic,
		&profile.Institute, &profile.Direction, &profile.Program,
		&profile.Course, &profile.GroupName, &profile.Phone, &profile.Bio,
		&interests, &competencies, &technologies, &links, &profile.PhotoFileID,
	)
	if err != nil {
		return nil, fmt.Errorf("select user by id: %w", err)
	}

	if profile.FirstName != "" || profile.LastName != "" {
		if err := json.Unmarshal(interests, &profile.ProfessionalInterests); err != nil {
			return nil, fmt.Errorf("decode professional interests: %w", err)
		}
		if err := json.Unmarshal(competencies, &profile.Competencies); err != nil {
			return nil, fmt.Errorf("decode competencies: %w", err)
		}
		if err := json.Unmarshal(technologies, &profile.Technologies); err != nil {
			return nil, fmt.Errorf("decode technologies: %w", err)
		}
		if err := json.Unmarshal(links, &profile.Links); err != nil {
			return nil, fmt.Errorf("decode student links: %w", err)
		}
		user.Student = &profile
	}

	roles, err := r.GetUserRoles(ctx, userID)
	if err != nil {
		return nil, err
	}
	user.Roles = roles
	return &user, nil
}

func (r *UsersRepo) GetUserRoles(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT r.code
		FROM user_roles ur
		JOIN roles r ON r.role_id = ur.role_id
		WHERE ur.user_id = $1
		ORDER BY r.code
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select user roles: %w", err)
	}
	defer rows.Close()

	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, fmt.Errorf("scan user role: %w", err)
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user roles: %w", err)
	}
	return roles, nil
}

func (r *UsersRepo) RecordFailedLogin(ctx context.Context, userID string, maxAttempts int, lockedUntil time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET failed_login_count = failed_login_count + 1,
			locked_until = CASE
				WHEN failed_login_count + 1 >= $2 THEN $3
				ELSE locked_until
			END
		WHERE user_id = $1
	`, userID, maxAttempts, lockedUntil)
	if err != nil {
		return fmt.Errorf("record failed login: %w", err)
	}
	return nil
}

func (r *UsersRepo) RecordSuccessfulLogin(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("record successful login: %w", err)
	}
	return nil
}

func (r *UsersRepo) SetUserStatus(ctx context.Context, userID, status string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin user status update: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `UPDATE users SET status = $2 WHERE user_id = $1`, userID, status)
	if err != nil {
		return fmt.Errorf("update user status: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read updated user count: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if status != "active" {
		if _, err := tx.ExecContext(ctx, `
			UPDATE auth_sessions
			SET revoked_at = CURRENT_TIMESTAMP
			WHERE user_id = $1 AND revoked_at IS NULL
		`, userID); err != nil {
			return fmt.Errorf("revoke user sessions: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit user status update: %w", err)
	}
	return nil
}
