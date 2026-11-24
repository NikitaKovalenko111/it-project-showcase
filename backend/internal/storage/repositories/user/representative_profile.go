package users_repo

import (
	"context"
	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/internal/storage/audit"
)

const representativeAccess = `status='active' AND EXISTS(
 SELECT 1 FROM showcase.user_roles ur JOIN showcase.roles r USING(role_id)
 WHERE ur.user_id=users.user_id AND r.code='company_representative')`

func (r *UsersRepo) GetRepresentativeProfile(ctx context.Context, userID string) (*models.RepresentativeProfile, error) {
	var p models.RepresentativeProfile
	err := r.db.QueryRowContext(ctx, `SELECT user_id,experience_and_interests,help_topics FROM showcase.users WHERE user_id=$1 AND `+representativeAccess, userID).Scan(&p.UserID, &p.ExperienceAndInterests, &p.HelpTopics)
	return &p, err
}

func (r *UsersRepo) UpdateRepresentativeProfile(ctx context.Context, userID string, input models.RepresentativeProfilePatch) (*models.RepresentativeProfile, error) {
	tx, err := audit.Begin(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var p models.RepresentativeProfile
	err = tx.QueryRowContext(ctx, `UPDATE showcase.users SET experience_and_interests=COALESCE($2,experience_and_interests),
 help_topics=COALESCE($3,help_topics) WHERE user_id=$1 AND `+representativeAccess+`
 RETURNING user_id,experience_and_interests,help_topics`, userID, input.ExperienceAndInterests, input.HelpTopics).Scan(&p.UserID, &p.ExperienceAndInterests, &p.HelpTopics)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return &p, nil
}
