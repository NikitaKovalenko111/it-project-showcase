package team_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"it-project-showcase/backend/internal/models"
)

var (
	ErrForbidden         = errors.New("team access denied")
	ErrInvalidTransition = errors.New("invalid team invitation transition")
	ErrReferenceNotFound = errors.New("team reference not found")
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

const teamSelect = `SELECT t.team_id,t.name,t.leader_id,t.status,t.description,t.visibility,t.looking_for_members,t.created_at,t.updated_at,
COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id',m.student_id,'name',concat_ws(' ',s.last_name,s.first_name,s.patronymic),'role_id',m.role_id,'role_name',COALESCE(r.name,''),'joined_at',m.joined_at,'left_at',m.left_at) ORDER BY m.joined_at,m.student_id) FROM team_members m JOIN students s ON s.user_id=m.student_id LEFT JOIN team_roles r ON r.team_role_id=m.role_id WHERE m.team_id=t.team_id),'[]'::jsonb)
FROM teams t`

func scanTeam(row interface{ Scan(...any) error }) (*models.Team, error) {
	var item models.Team
	var members []byte
	err := row.Scan(&item.TeamID, &item.Name, &item.LeaderID, &item.Status, &item.Description, &item.Visibility, &item.LookingForMembers, &item.CreatedAt, &item.UpdatedAt, &members)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(members, &item.Members); err != nil {
		return nil, fmt.Errorf("decode team members: %w", err)
	}
	return &item, nil
}

func (r *Repository) Create(ctx context.Context, userID, name string) (*models.Team, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin team creation: %w", err)
	}
	defer tx.Rollback()
	var teamID string
	err = tx.QueryRowContext(ctx, `INSERT INTO teams(name,leader_id) SELECT $2,$1 FROM students s JOIN users u ON u.user_id=s.user_id WHERE s.user_id=$1 AND u.status='active' RETURNING team_id`, userID, name).Scan(&teamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("create team: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO team_members(team_id,student_id) VALUES($1,$2)`, teamID, userID); err != nil {
		return nil, fmt.Errorf("add team leader: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit team creation: %w", err)
	}
	return r.Get(ctx, userID, teamID, false)
}

func (r *Repository) Get(ctx context.Context, userID, teamID string, admin bool) (*models.Team, error) {
	item, err := scanTeam(r.db.QueryRowContext(ctx, teamSelect+` WHERE t.team_id=$1 AND ($3 OR EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.team_id AND m.student_id=$2 AND m.left_at IS NULL))`, teamID, userID, admin))
	if err != nil {
		return nil, fmt.Errorf("get team: %w", err)
	}
	return item, nil
}

func (r *Repository) Invite(ctx context.Context, leaderID, teamID, studentID string, roleID *string) (*models.TeamInvitation, error) {
	var item models.TeamInvitation
	err := r.db.QueryRowContext(ctx, `INSERT INTO team_invitations(team_id,invited_by,student_id,role_id)
	SELECT t.team_id,$2,s.user_id,$4 FROM teams t JOIN students s ON s.user_id=$3 JOIN users u ON u.user_id=s.user_id
	WHERE t.team_id=$1 AND t.leader_id=$2 AND t.status='active' AND u.status='active'
	AND NOT EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.team_id AND m.student_id=s.user_id AND m.left_at IS NULL)
	AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM team_roles r WHERE r.team_role_id=$4 AND r.is_active))
	RETURNING team_invitation_id,team_id,(SELECT name FROM teams WHERE team_id=$1),invited_by,student_id,role_id,status,created_at,responded_at`, teamID, leaderID, studentID, roleID).Scan(&item.TeamInvitationID, &item.TeamID, &item.TeamName, &item.InvitedBy, &item.StudentID, &item.RoleID, &item.Status, &item.CreatedAt, &item.RespondedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("create team invitation: %w", err)
	}
	return &item, nil
}

func (r *Repository) ListInvitations(ctx context.Context, studentID, status string, limit int, before *time.Time, beforeID string) ([]models.TeamInvitation, error) {
	query := `SELECT i.team_invitation_id,i.team_id,t.name,i.invited_by,i.student_id,i.role_id,i.status,i.created_at,i.responded_at FROM team_invitations i JOIN teams t ON t.team_id=i.team_id WHERE i.student_id=$1 AND i.status=$2`
	args := []any{studentID, status}
	if before != nil {
		args = append(args, *before, beforeID)
		query += ` AND (i.created_at,i.team_invitation_id)<($3,$4)`
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY i.created_at DESC,i.team_invitation_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list team invitations: %w", err)
	}
	defer rows.Close()
	items := make([]models.TeamInvitation, 0)
	for rows.Next() {
		var item models.TeamInvitation
		if err = rows.Scan(&item.TeamInvitationID, &item.TeamID, &item.TeamName, &item.InvitedBy, &item.StudentID, &item.RoleID, &item.Status, &item.CreatedAt, &item.RespondedAt); err != nil {
			return nil, fmt.Errorf("scan team invitation: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) Respond(ctx context.Context, studentID, invitationID, status string) (*models.Team, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin invitation response: %w", err)
	}
	defer tx.Rollback()
	var teamID string
	var roleID sql.NullString
	var current string
	err = tx.QueryRowContext(ctx, `SELECT team_id,role_id,status FROM team_invitations WHERE team_invitation_id=$1 AND student_id=$2 FOR UPDATE`, invitationID, studentID).Scan(&teamID, &roleID, &current)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("get invitation: %w", err)
	}
	if current != "pending" {
		return nil, ErrInvalidTransition
	}
	if _, err = tx.ExecContext(ctx, `UPDATE team_invitations SET status=$2,responded_at=CURRENT_TIMESTAMP WHERE team_invitation_id=$1`, invitationID, status); err != nil {
		return nil, fmt.Errorf("respond invitation: %w", err)
	}
	if status == "accepted" {
		if _, err = tx.ExecContext(ctx, `INSERT INTO team_members(team_id,student_id,role_id) VALUES($1,$2,$3) ON CONFLICT(team_id,student_id) DO UPDATE SET role_id=EXCLUDED.role_id,joined_at=CURRENT_TIMESTAMP,left_at=NULL`, teamID, studentID, roleID); err != nil {
			return nil, fmt.Errorf("join team: %w", err)
		}
		if _, err = tx.ExecContext(ctx, `UPDATE applications a SET status='consent_pending' WHERE a.team_id=$1 AND a.status IN ('submitted','info_requested','interview') AND NOT EXISTS(SELECT 1 FROM application_consents consent WHERE consent.application_id=a.application_id AND consent.student_id=$2 AND consent.case_revision_id=a.case_revision_id)`, teamID, studentID); err != nil {
			return nil, fmt.Errorf("reopen team application consents: %w", err)
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit invitation response: %w", err)
	}
	return r.Get(ctx, studentID, teamID, false)
}

func (r *Repository) ListMine(ctx context.Context, userID string) ([]models.Team, error) {
	rows, err := r.db.QueryContext(ctx, teamSelect+` WHERE EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.team_id AND m.student_id=$1 AND m.left_at IS NULL) ORDER BY t.created_at,t.team_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.Team, 0)
	for rows.Next() {
		item, err := scanTeam(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}
