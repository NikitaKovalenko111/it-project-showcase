package case_repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"it-project-showcase/backend/internal/models"
)

var (
	ErrAccessDenied      = errors.New("case access denied")
	ErrInvalidTransition = errors.New("invalid case status transition")
	ErrReferenceNotFound = errors.New("case reference not found")
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

const caseSelectQuery = `
SELECT c.case_id,c.company_id,company.full_name,c.created_by,c.title,c.summary,c.full_brief,
       c.type,COALESCE(c.difficulty,''),c.work_format,c.participation_mode,c.admission_mode,
       c.capacity,c.team_size_min,c.team_size_max,c.course_min,c.course_max,
       c.application_deadline,c.due_at,COALESCE(c.duration,''),c.result_requirements,
       COALESCE(c.evaluation_rules,''),c.ip_terms,c.terms_version,c.nda_required,c.status,
       c.visibility,c.cover_file_id,c.created_at,c.updated_at,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.direction_id,'name',d.name) ORDER BY d.name)
                 FROM case_directions cd JOIN directions d ON d.direction_id=cd.direction_id
                 WHERE cd.case_id=c.case_id),'[]'::jsonb),
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',cp.competency_id,'name',cp.name,'required_level',COALESCE(cc.required_level,'')) ORDER BY cp.name)
                 FROM case_competencies cc JOIN competencies cp ON cp.competency_id=cc.competency_id
                 WHERE cc.case_id=c.case_id),'[]'::jsonb),
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.technology_id,'name',t.name) ORDER BY t.name)
                 FROM case_technologies ct JOIN technologies t ON t.technology_id=ct.technology_id
                 WHERE ct.case_id=c.case_id),'[]'::jsonb),
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'case_reward_id',r.case_reward_id,'kind',r.kind,'description',r.description,
                    'conditions',COALESCE(r.conditions,''),'amount',r.amount,'currency',COALESCE(r.currency,''),
                    'prize_fund',r.prize_fund,'prize_places',COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'prize_place_id',p.prize_place_id,'place_no',p.place_no,'nomination',COALESCE(p.nomination,''),'amount',p.amount)
                        ORDER BY p.place_no NULLS LAST,p.prize_place_id) FROM prize_places p WHERE p.case_reward_id=r.case_reward_id),'[]'::jsonb))
                 ORDER BY r.case_reward_id) FROM case_rewards r WHERE r.case_id=c.case_id),'[]'::jsonb),
       COALESCE((SELECT jsonb_agg(jsonb_build_object('file_id',f.file_id,'original_name',f.original_name,
                    'mime_type',f.mime_type,'size_bytes',f.size_bytes,'visibility',cf.visibility) ORDER BY f.created_at,f.file_id)
                 FROM case_files cf JOIN files f ON f.file_id=cf.file_id AND f.status='active'
                 WHERE cf.case_id=c.case_id /*FILE_VISIBILITY*/),'[]'::jsonb),
       COALESCE((SELECT jsonb_agg(jsonb_build_object('criterion_id',ec.criterion_id,'name',ec.name,'max_score',ec.max_score,'ordinal',ec.ordinal) ORDER BY ec.ordinal)
                 FROM evaluation_criteria ec WHERE ec.case_id=c.case_id),'[]'::jsonb)
FROM cases c JOIN companies company ON company.company_id=c.company_id`

func caseSelect(includePrivateFiles bool) string {
	visibility := " AND cf.visibility='public'"
	if includePrivateFiles {
		visibility = ""
	}
	return strings.Replace(caseSelectQuery, "/*FILE_VISIBILITY*/", visibility, 1)
}

func scanCase(row interface{ Scan(...any) error }) (*models.Case, error) {
	var item models.Case
	var directions, competencies, technologies, rewards, files, criteria []byte
	err := row.Scan(
		&item.CaseID, &item.CompanyID, &item.CompanyName, &item.CreatedBy, &item.Title, &item.Summary,
		&item.FullBrief, &item.Type, &item.Difficulty, &item.WorkFormat, &item.ParticipationMode,
		&item.AdmissionMode, &item.Capacity, &item.TeamSizeMin, &item.TeamSizeMax, &item.CourseMin,
		&item.CourseMax, &item.ApplicationDeadline, &item.DueAt, &item.Duration, &item.ResultRequirements,
		&item.EvaluationRules, &item.IPTerms, &item.TermsVersion, &item.NDARequired, &item.Status,
		&item.Visibility, &item.CoverFileID, &item.CreatedAt, &item.UpdatedAt, &directions, &competencies, &technologies,
		&rewards, &files, &criteria,
	)
	if err != nil {
		return nil, err
	}
	for _, target := range []struct {
		data []byte
		out  any
	}{{directions, &item.Directions}, {competencies, &item.RequiredCompetencies}, {technologies, &item.Technologies}, {rewards, &item.Rewards}, {files, &item.Files}, {criteria, &item.EvaluationCriteria}} {
		if err := json.Unmarshal(target.data, target.out); err != nil {
			return nil, fmt.Errorf("decode case relation: %w", err)
		}
	}
	return &item, nil
}

func (r *Repository) List(ctx context.Context, filter models.CaseListFilter, limit int, before *time.Time, beforeID string) ([]models.Case, error) {
	query := caseSelect(filter.IncludeRestricted) + ` WHERE c.status = ANY($1)`
	args := []any{filter.Statuses}
	if !filter.IncludeRestricted {
		query += ` AND c.visibility='public'`
	}
	add := func(condition string, value any) {
		args = append(args, value)
		query += fmt.Sprintf(" AND "+condition, len(args))
	}
	if filter.Search != "" {
		args = append(args, "%"+filter.Search+"%")
		query += fmt.Sprintf(" AND (c.title ILIKE $%d OR c.summary ILIKE $%d OR company.full_name ILIKE $%d)", len(args), len(args), len(args))
	}
	if filter.CompanyID != "" {
		add("c.company_id=$%d", filter.CompanyID)
	}
	if filter.DirectionID != "" {
		add("EXISTS (SELECT 1 FROM case_directions x WHERE x.case_id=c.case_id AND x.direction_id=$%d)", filter.DirectionID)
	}
	if filter.Difficulty != "" {
		add("c.difficulty=$%d", filter.Difficulty)
	}
	if filter.ParticipationMode != "" {
		add("c.participation_mode=$%d", filter.ParticipationMode)
	}
	if filter.WorkFormat != "" {
		add("c.work_format=$%d", filter.WorkFormat)
	}
	if filter.Type != "" {
		add("c.type=$%d", filter.Type)
	}
	if filter.HasReward != nil {
		if *filter.HasReward {
			query += ` AND EXISTS (SELECT 1 FROM case_rewards x WHERE x.case_id=c.case_id)`
		} else {
			query += ` AND NOT EXISTS (SELECT 1 FROM case_rewards x WHERE x.case_id=c.case_id)`
		}
	}
	if before != nil {
		args = append(args, *before, beforeID)
		query += fmt.Sprintf(" AND (c.created_at,c.case_id)<($%d,$%d)", len(args)-1, len(args))
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY c.created_at DESC,c.case_id DESC LIMIT $%d", len(args))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list cases: %w", err)
	}
	defer rows.Close()
	items := make([]models.Case, 0)
	for rows.Next() {
		item, err := scanCase(rows)
		if err != nil {
			return nil, fmt.Errorf("scan case: %w", err)
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate cases: %w", err)
	}
	return items, nil
}

func (r *Repository) GetPublic(ctx context.Context, caseID string) (*models.Case, error) {
	item, err := scanCase(r.db.QueryRowContext(ctx, caseSelect(false)+` WHERE c.case_id=$1 AND c.status IN ('published','in_progress','completed') AND c.visibility='public'`, caseID))
	if err != nil {
		return nil, fmt.Errorf("get public case: %w", err)
	}
	return item, nil
}

func (r *Repository) GetManaged(ctx context.Context, userID, caseID string, admin bool) (*models.Case, error) {
	item, err := scanCase(r.db.QueryRowContext(ctx, caseSelect(true)+` WHERE c.case_id=$1 AND ($3 OR EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company'))`, caseID, userID, admin))
	if err != nil {
		return nil, fmt.Errorf("get managed case: %w", err)
	}
	return item, nil
}

func (r *Repository) Create(ctx context.Context, userID string, input models.CaseInput) (*models.Case, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin case creation: %w", err)
	}
	defer tx.Rollback()
	var caseID string
	err = tx.QueryRowContext(ctx, `INSERT INTO cases (company_id,created_by,title,summary,full_brief,type,difficulty,work_format,participation_mode,admission_mode,capacity,team_size_min,team_size_max,course_min,course_max,application_deadline,due_at,duration,result_requirements,evaluation_rules,ip_terms,nda_required,visibility)
		SELECT $1,$2,$3,$4,$5,$6,NULLIF($7,''),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULLIF($18,''),$19,NULLIF($20,''),$21,$22,$23
		WHERE EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id=$1 AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING case_id`,
		input.CompanyID, userID, input.Title, input.Summary, input.FullBrief, input.Type, input.Difficulty, input.WorkFormat, input.ParticipationMode, input.AdmissionMode, input.Capacity, input.TeamSizeMin, input.TeamSizeMax, input.CourseMin, input.CourseMax, input.ApplicationDeadline, input.DueAt, input.Duration, input.ResultRequirements, input.EvaluationRules, input.IPTerms, input.NDARequired, input.Visibility).Scan(&caseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, fmt.Errorf("create case: %w", err)
	}
	if err := writeCaseRelations(ctx, tx, caseID, userID, input, true); err != nil {
		return nil, err
	}
	if err := insertRevision(ctx, tx, caseID, userID, 1, input); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit case creation: %w", err)
	}
	return r.GetManaged(ctx, userID, caseID, false)
}

func (r *Repository) Update(ctx context.Context, userID, caseID string, input models.CaseInput) (*models.Case, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin case update: %w", err)
	}
	defer tx.Rollback()
	var companyID, status string
	var version int
	err = tx.QueryRowContext(ctx, `SELECT c.company_id,c.status,c.terms_version FROM cases c WHERE c.case_id=$1 AND EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') FOR UPDATE`, caseID, userID).Scan(&companyID, &status, &version)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, fmt.Errorf("lock case: %w", err)
	}
	if companyID != input.CompanyID || (status != "draft" && status != "revision" && status != "published") {
		return nil, ErrInvalidTransition
	}
	if status != "draft" {
		unchanged, compareErr := evaluationCriteriaUnchanged(ctx, tx, caseID, input.EvaluationCriteria)
		if compareErr != nil {
			return nil, compareErr
		}
		if !unchanged {
			return nil, ErrInvalidTransition
		}
	}
	version++
	_, err = tx.ExecContext(ctx, `UPDATE cases SET title=$2,summary=$3,full_brief=$4,type=$5,difficulty=NULLIF($6,''),work_format=$7,participation_mode=$8,admission_mode=$9,capacity=$10,team_size_min=$11,team_size_max=$12,course_min=$13,course_max=$14,application_deadline=$15,due_at=$16,duration=NULLIF($17,''),result_requirements=$18,evaluation_rules=NULLIF($19,''),ip_terms=$20,terms_version=$21,nda_required=$22,visibility=$23,status=CASE WHEN status='published' THEN 'revision' ELSE status END WHERE case_id=$1`, caseID, input.Title, input.Summary, input.FullBrief, input.Type, input.Difficulty, input.WorkFormat, input.ParticipationMode, input.AdmissionMode, input.Capacity, input.TeamSizeMin, input.TeamSizeMax, input.CourseMin, input.CourseMax, input.ApplicationDeadline, input.DueAt, input.Duration, input.ResultRequirements, input.EvaluationRules, input.IPTerms, version, input.NDARequired, input.Visibility)
	if err != nil {
		return nil, fmt.Errorf("update case: %w", err)
	}
	criteriaMutable := status == "draft"
	if err := clearCaseRelations(ctx, tx, caseID, criteriaMutable); err != nil {
		return nil, err
	}
	if err := writeCaseRelations(ctx, tx, caseID, userID, input, criteriaMutable); err != nil {
		return nil, err
	}
	if err := insertRevision(ctx, tx, caseID, userID, version, input); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit case update: %w", err)
	}
	return r.GetManaged(ctx, userID, caseID, false)
}

func (r *Repository) SubmitForModeration(ctx context.Context, userID, caseID string) (*models.Case, error) {
	return r.transitionByMember(ctx, userID, caseID, []string{"draft", "revision"}, "moderation")
}

func (r *Repository) Cancel(ctx context.Context, userID, caseID string) (*models.Case, error) {
	return r.transitionByMember(ctx, userID, caseID, []string{"draft", "moderation", "revision", "published"}, "cancelled")
}

func (r *Repository) transitionByMember(ctx context.Context, userID, caseID string, allowed []string, next string) (*models.Case, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin case transition: %w", err)
	}
	defer tx.Rollback()
	var current string
	err = tx.QueryRowContext(ctx, `SELECT c.status FROM cases c WHERE c.case_id=$1 AND EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') FOR UPDATE`, caseID, userID).Scan(&current)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, fmt.Errorf("authorize case transition: %w", err)
	}
	valid := false
	for _, status := range allowed {
		if current == status {
			valid = true
			break
		}
	}
	if !valid {
		return nil, ErrInvalidTransition
	}
	if _, err = tx.ExecContext(ctx, `UPDATE cases SET status=$2 WHERE case_id=$1`, caseID, next); err != nil {
		return nil, fmt.Errorf("apply case transition: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit case transition: %w", err)
	}
	return r.GetManaged(ctx, userID, caseID, false)
}

func (r *Repository) Moderate(ctx context.Context, moderatorID, caseID, decision, comment string) (*models.Case, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin case moderation: %w", err)
	}
	defer tx.Rollback()
	var previous, revisionID, companyStatus string
	err = tx.QueryRowContext(ctx, `SELECT c.status,r.case_revision_id,company.status FROM cases c JOIN companies company ON company.company_id=c.company_id JOIN case_revisions r ON r.case_id=c.case_id AND r.version_no=c.terms_version WHERE c.case_id=$1 FOR UPDATE OF c`, caseID).Scan(&previous, &revisionID, &companyStatus)
	if err != nil {
		return nil, fmt.Errorf("select case moderation target: %w", err)
	}
	if decision != "hide" && previous != "moderation" {
		return nil, ErrInvalidTransition
	}
	if decision == "approve" && companyStatus != "approved" {
		return nil, ErrInvalidTransition
	}
	newStatus := map[string]string{"approve": "published", "request_revision": "revision", "reject": "revision", "hide": "hidden"}[decision]
	if newStatus == "" {
		return nil, ErrInvalidTransition
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO case_moderation_events (case_id,case_revision_id,moderator_id,previous_status,new_status,decision,comment) VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''))`, caseID, revisionID, moderatorID, previous, newStatus, decision, comment)
	if err != nil {
		return nil, fmt.Errorf("record case moderation: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE cases SET status=$2 WHERE case_id=$1`, caseID, newStatus); err != nil {
		return nil, fmt.Errorf("apply case moderation: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit case moderation: %w", err)
	}
	return r.GetManaged(ctx, moderatorID, caseID, true)
}

func clearCaseRelations(ctx context.Context, tx *sql.Tx, caseID string, includeCriteria bool) error {
	statements := []string{
		`DELETE FROM case_directions WHERE case_id=$1`,
		`DELETE FROM case_competencies WHERE case_id=$1`,
		`DELETE FROM case_technologies WHERE case_id=$1`,
		`DELETE FROM case_files WHERE case_id=$1`,
		`DELETE FROM prize_places WHERE case_reward_id IN (SELECT case_reward_id FROM case_rewards WHERE case_id=$1)`,
		`DELETE FROM case_rewards WHERE case_id=$1`,
	}
	if includeCriteria {
		statements = append(statements, `DELETE FROM evaluation_criteria WHERE case_id=$1`)
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement, caseID); err != nil {
			return fmt.Errorf("clear case relations: %w", err)
		}
	}
	return nil
}

func writeCaseRelations(ctx context.Context, tx *sql.Tx, caseID, userID string, input models.CaseInput, includeCriteria bool) error {
	for _, id := range input.DirectionIDs {
		result, err := tx.ExecContext(ctx, `INSERT INTO case_directions (case_id,direction_id) SELECT $1,direction_id FROM directions WHERE direction_id=$2 AND is_active`, caseID, id)
		if err != nil {
			return fmt.Errorf("attach case direction: %w", err)
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return ErrReferenceNotFound
		}
	}
	for _, value := range input.Competencies {
		result, err := tx.ExecContext(ctx, `INSERT INTO case_competencies (case_id,competency_id,required_level) SELECT $1,competency_id,NULLIF($3,'') FROM competencies WHERE competency_id=$2 AND is_active`, caseID, value.ID, value.RequiredLevel)
		if err != nil {
			return fmt.Errorf("attach case competency: %w", err)
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return ErrReferenceNotFound
		}
	}
	for _, id := range input.TechnologyIDs {
		result, err := tx.ExecContext(ctx, `INSERT INTO case_technologies (case_id,technology_id) SELECT $1,technology_id FROM technologies WHERE technology_id=$2 AND is_active`, caseID, id)
		if err != nil {
			return fmt.Errorf("attach case technology: %w", err)
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return ErrReferenceNotFound
		}
	}
	for _, value := range input.Files {
		result, err := tx.ExecContext(ctx, `INSERT INTO case_files (case_id,file_id,visibility) SELECT $1,file_id,$3 FROM files WHERE file_id=$2 AND uploaded_by=$4 AND status='active'`, caseID, value.FileID, value.Visibility, userID)
		if err != nil {
			return fmt.Errorf("attach case file: %w", err)
		}
		if count, _ := result.RowsAffected(); count != 1 {
			return ErrReferenceNotFound
		}
	}
	for _, reward := range input.Rewards {
		var rewardID string
		err := tx.QueryRowContext(ctx, `INSERT INTO case_rewards (case_id,kind,description,conditions,amount,currency,prize_fund) VALUES ($1,$2,$3,NULLIF($4,''),$5,NULLIF(UPPER($6),''),$7) RETURNING case_reward_id`, caseID, reward.Kind, reward.Description, reward.Conditions, reward.Amount, reward.Currency, reward.PrizeFund).Scan(&rewardID)
		if err != nil {
			return fmt.Errorf("create case reward: %w", err)
		}
		for _, place := range reward.PrizePlaces {
			if _, err := tx.ExecContext(ctx, `INSERT INTO prize_places (case_reward_id,place_no,nomination,amount) VALUES ($1,$2,NULLIF($3,''),$4)`, rewardID, place.PlaceNo, place.Nomination, place.Amount); err != nil {
				return fmt.Errorf("create prize place: %w", err)
			}
		}
	}
	if includeCriteria {
		for _, criterion := range input.EvaluationCriteria {
			if _, err := tx.ExecContext(ctx, `INSERT INTO evaluation_criteria(case_id,name,max_score,ordinal) VALUES($1,$2,$3,$4)`, caseID, criterion.Name, criterion.MaxScore, criterion.Ordinal); err != nil {
				return fmt.Errorf("create evaluation criterion: %w", err)
			}
		}
	}
	return nil
}

func evaluationCriteriaUnchanged(ctx context.Context, tx *sql.Tx, caseID string, input []models.EvaluationCriterionInput) (bool, error) {
	rows, err := tx.QueryContext(ctx, `SELECT name,max_score,ordinal FROM evaluation_criteria WHERE case_id=$1`, caseID)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	type criterion struct {
		name string
		max  float64
	}
	existing := map[int]criterion{}
	for rows.Next() {
		var x criterion
		var ordinal int
		if err = rows.Scan(&x.name, &x.max, &ordinal); err != nil {
			return false, err
		}
		existing[ordinal] = x
	}
	if err = rows.Err(); err != nil {
		return false, err
	}
	if len(existing) != len(input) {
		return false, nil
	}
	for _, x := range input {
		saved, ok := existing[x.Ordinal]
		if !ok || saved.name != x.Name || math.Abs(saved.max-x.MaxScore) > 1e-9 {
			return false, nil
		}
	}
	return true, nil
}

func (r *Repository) ListStages(ctx context.Context, caseID string, public bool, userID string, admin bool) ([]models.CaseStage, error) {
	var allowed bool
	if err := r.db.QueryRowContext(ctx, `SELECT (($2 AND c.status IN ('published','in_progress','completed') AND c.visibility='public') OR $4 OR EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company')) FROM cases c WHERE c.case_id=$1`, caseID, public, userID, admin).Scan(&allowed); err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrAccessDenied
	}
	query := `SELECT s.stage_id,s.case_id,s.ordinal,s.title,COALESCE(s.expected_result,''),s.due_at FROM case_stages s JOIN cases c ON c.case_id=s.case_id WHERE s.case_id=$1 AND (($2 AND c.status IN ('published','in_progress','completed') AND c.visibility='public') OR $4 OR EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company')) ORDER BY s.ordinal`
	rows, err := r.db.QueryContext(ctx, query, caseID, public, userID, admin)
	if err != nil {
		return nil, fmt.Errorf("list case stages: %w", err)
	}
	defer rows.Close()
	items := make([]models.CaseStage, 0)
	for rows.Next() {
		var x models.CaseStage
		if err = rows.Scan(&x.StageID, &x.CaseID, &x.Ordinal, &x.Title, &x.ExpectedResult, &x.DueAt); err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
func (r *Repository) DeleteStage(ctx context.Context, userID, caseID, stageID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM case_stages s USING cases c WHERE s.stage_id=$2 AND s.case_id=$1 AND c.case_id=s.case_id AND c.status IN ('draft','revision') AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$3 AND cm.status='active' AND cm.permissions ? 'manage_company')`, caseID, stageID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrAccessDenied
	}
	return nil
}

func (r *Repository) CreateStage(ctx context.Context, userID, caseID string, input models.CaseStageInput) (*models.CaseStage, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin case stage creation: %w", err)
	}
	defer tx.Rollback()
	var x models.CaseStage
	err = tx.QueryRowContext(ctx, `INSERT INTO case_stages(case_id,ordinal,title,expected_result,due_at) SELECT c.case_id,$3,$4,NULLIF($5,''),$6 FROM cases c WHERE c.case_id=$1 AND c.status IN ('draft','revision') AND EXISTS(SELECT 1 FROM company_members cm WHERE cm.company_id=c.company_id AND cm.user_id=$2 AND cm.status='active' AND cm.permissions ? 'manage_company') RETURNING stage_id,case_id,ordinal,title,COALESCE(expected_result,''),due_at`, caseID, userID, input.Ordinal, input.Title, input.ExpectedResult, input.DueAt).Scan(&x.StageID, &x.CaseID, &x.Ordinal, &x.Title, &x.ExpectedResult, &x.DueAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAccessDenied
	}
	if err != nil {
		return nil, fmt.Errorf("create case stage: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO execution_stages(execution_id,stage_id) SELECT execution_id,$1 FROM executions WHERE case_id=$2 ON CONFLICT DO NOTHING`, x.StageID, caseID); err != nil {
		return nil, fmt.Errorf("initialize execution stage: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit case stage creation: %w", err)
	}
	return &x, nil
}

func insertRevision(ctx context.Context, tx *sql.Tx, caseID, userID string, version int, input models.CaseInput) error {
	brief, err := json.Marshal(input)
	if err != nil {
		return fmt.Errorf("encode case revision: %w", err)
	}
	rewards, err := json.Marshal(input.Rewards)
	if err != nil {
		return fmt.Errorf("encode reward revision: %w", err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO case_revisions (case_id,version_no,brief_snapshot,ip_terms_snapshot,reward_snapshot,created_by) VALUES ($1,$2,$3,$4,$5,$6)`, caseID, version, brief, input.IPTerms, rewards, userID)
	if err != nil {
		return fmt.Errorf("create case revision: %w", err)
	}
	return nil
}

func IsConstraintError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "SQLSTATE 23514")
}
