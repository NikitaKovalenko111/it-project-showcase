package file_repo

import (
	"context"
	"it-project-showcase/backend/internal/models"
)

const eventFileColumns = `f.file_id,f.storage_key,f.original_name,f.mime_type,f.size_bytes,f.checksum_sha256,f.uploaded_by,f.created_at`

func (r *Repository) GetEventTaskFile(ctx context.Context, user, caseID, roundID, taskID, fileID string, admin bool) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT `+eventFileColumns+`
		FROM event_plans p CROSS JOIN LATERAL jsonb_array_elements(p.plan->'rounds') x(value)
		CROSS JOIN LATERAL jsonb_array_elements(x.value->'tasks') t(value)
		JOIN files f ON f.file_id=$5 AND f.status='active'
		WHERE p.case_id=$1 AND x.value->>'round_id'=$3 AND t.value->>'task_id'=$4
		AND t.value->'file_ids' @> jsonb_build_array(f.file_id::text)
		AND showcase.can_read_event_tasks(p.case_id,$2,$6,(x.value->>'opens_at')::timestamptz)`, caseID, user, roundID, taskID, fileID, admin))
}

func (r *Repository) GetEventSolutionFile(ctx context.Context, user, execution, roundID, fileID string, admin bool) (*models.File, error) {
	return scanFile(r.db.QueryRowContext(ctx, `SELECT `+eventFileColumns+`
		FROM event_round_submissions s JOIN executions e ON e.execution_id=s.execution_id JOIN cases c ON c.case_id=e.case_id
		JOIN files f ON f.file_id=$4 AND f.status='active'
		WHERE s.execution_id=$1 AND s.round_id=$3 AND s.solutions @> jsonb_build_array(jsonb_build_object('file_id',f.file_id::text))
		AND ($5 OR EXISTS(SELECT 1 FROM execution_members m WHERE m.execution_id=e.execution_id AND m.student_id=$2 AND m.left_at IS NULL)
		OR EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=c.company_id AND m.user_id=$2 AND m.status='active' AND m.permissions ? 'manage_company'))`,
		execution, user, roundID, fileID, admin))
}
