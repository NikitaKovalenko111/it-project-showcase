package users_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"it-project-showcase/backend/internal/models"
)

func (r *UsersRepo) RegisterRoleApplicant(ctx context.Context, input models.StudentRegistration, hash string) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var id string
	if err = tx.QueryRowContext(ctx, `INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING user_id`, input.Username, input.Email, hash).Scan(&id); err != nil {
		return "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_consents(user_id,consent_type,version) VALUES($1,'personal_data',$2)`, id, input.ConsentVersion); err != nil {
		return "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO role_requests(user_id,role_code) VALUES($1,$2)`, id, input.RequestedRole); err != nil {
		return "", err
	}
	return id, tx.Commit()
}

func (r *UsersRepo) RoleRequestStatus(ctx context.Context, id string) (string, error) {
	var status string
	err := r.db.QueryRowContext(ctx, `SELECT status FROM role_requests WHERE user_id=$1`, id).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return status, err
}

func (r *UsersRepo) ReviewRole(ctx context.Context, moderator, userID, status string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var role string
	err = tx.QueryRowContext(ctx, `UPDATE role_requests SET status=$3,reviewed_by=$1,reviewed_at=CURRENT_TIMESTAMP
		WHERE user_id=$2 AND status='pending' RETURNING role_code`, moderator, userID, status).Scan(&role)
	if err != nil {
		return err
	}
	if status == "approved" {
		if _, err = tx.ExecContext(ctx, `INSERT INTO user_roles(user_id,role_id)
			SELECT $1,role_id FROM roles WHERE code=$2 ON CONFLICT DO NOTHING`, userID, role); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *UsersRepo) ListUsers(ctx context.Context, limit int, offset int64) ([]models.UserListItem, int64, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT u.user_id,u.username,u.email,u.status,q.role_code,q.status,
		COALESCE((SELECT jsonb_agg(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.role_id=ur.role_id WHERE ur.user_id=u.user_id),'[]'::jsonb)
		FROM users u LEFT JOIN role_requests q ON q.user_id=u.user_id ORDER BY u.created_at DESC,u.user_id DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]models.UserListItem, 0)
	for rows.Next() {
		var item models.UserListItem
		var roles []byte
		if err := rows.Scan(&item.UserID, &item.Username, &item.Email, &item.Status, &item.RequestedRole, &item.RoleRequestStatus, &roles); err != nil {
			return nil, 0, err
		}
		if err := json.Unmarshal(roles, &item.Roles); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int64
	err = r.db.QueryRowContext(ctx, `SELECT count(*) FROM users`).Scan(&total)
	return items, total, err
}

func (r *UsersRepo) UpdateStudentProfile(ctx context.Context, userID string, input models.StudentProfileUpdate) error {
	interests, err := jsonList(input.ProfessionalInterests)
	if err != nil {
		return err
	}
	competencies, err := jsonList(input.Competencies)
	if err != nil {
		return err
	}
	technologies, err := jsonList(input.Technologies)
	if err != nil {
		return err
	}
	links, err := jsonList(input.Links)
	if err != nil {
		return err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id string
	err = tx.QueryRowContext(ctx, `UPDATE users SET email=$2 WHERE user_id=$1 AND status='active' RETURNING user_id`, userID, input.Email).Scan(&id)
	if err != nil {
		return err
	}
	err = tx.QueryRowContext(ctx, `UPDATE students SET last_name=$2,first_name=$3,patronymic=NULLIF($4,''),institute_name=$5,
		study_direction=$6,program_name=NULLIF($7,''),education_level=NULLIF($8,''),course=$9,group_name=$10,phone=NULLIF($11,''),bio=NULLIF($12,''),
		professional_interests=$13::jsonb,competencies=$14::jsonb,technologies=$15::jsonb,links=$16::jsonb WHERE user_id=$1 RETURNING user_id`,
		id, input.LastName, input.FirstName, input.Patronymic, input.Institute, input.Direction, input.Program, input.EducationLevel, input.Course,
		input.GroupName, input.Phone, input.Bio, interests, competencies, technologies, links).Scan(&id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func jsonList[T any](items []T) (string, error) {
	if items == nil {
		return "[]", nil
	}
	data, err := json.Marshal(items)
	return string(data), err
}
