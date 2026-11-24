CREATE TABLE showcase.submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    stage_id UUID REFERENCES showcase.case_stages(stage_id),
    version_no INTEGER NOT NULL CHECK(version_no > 0),
    kind TEXT NOT NULL DEFAULT 'final' CHECK(kind IN ('stage','final')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    repository_url TEXT,
    demo_url TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted','revision','superseded')),
    submitted_by UUID NOT NULL REFERENCES showcase.users(user_id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    UNIQUE(execution_id,version_no), UNIQUE(submission_id,execution_id)
);
CREATE INDEX submissions_execution_list_idx ON showcase.submissions(execution_id,submitted_at DESC,submission_id DESC);

CREATE TABLE showcase.submission_files (
    submission_id UUID NOT NULL REFERENCES showcase.submissions(submission_id),
    file_id UUID NOT NULL REFERENCES showcase.files(file_id),
    kind TEXT NOT NULL DEFAULT 'attachment' CHECK(kind IN ('attachment','screenshot','presentation','documentation','source_archive')),
    ordinal INTEGER NOT NULL DEFAULT 1 CHECK(ordinal > 0),
    PRIMARY KEY(submission_id,file_id), UNIQUE(submission_id,kind,ordinal)
);

CREATE TABLE showcase.evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES showcase.submissions(submission_id),
    evaluator_id UUID NOT NULL REFERENCES showcase.users(user_id),
    status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','void')),
    total_score NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK(total_score >= 0),
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    UNIQUE(submission_id,evaluator_id)
);
CREATE INDEX evaluations_submission_idx ON showcase.evaluations(submission_id,created_at DESC,evaluation_id DESC);

CREATE TABLE showcase.criterion_scores (
    evaluation_id UUID NOT NULL REFERENCES showcase.evaluations(evaluation_id),
    criterion_id UUID NOT NULL REFERENCES showcase.evaluation_criteria(criterion_id),
    score NUMERIC(10,2) NOT NULL CHECK(score >= 0),
    comment TEXT,
    PRIMARY KEY(evaluation_id,criterion_id)
);

CREATE TABLE showcase.reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES showcase.submissions(submission_id),
    author_id UUID NOT NULL REFERENCES showcase.users(user_id),
    decision TEXT NOT NULL CHECK(decision IN ('accept','request_revision','comment')),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX reviews_submission_idx ON showcase.reviews(submission_id,created_at DESC,review_id DESC);

CREATE TABLE showcase.awards (
    award_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    title TEXT NOT NULL,
    place_no INTEGER CHECK(place_no > 0),
    amount NUMERIC(14,2) CHECK(amount >= 0),
    currency CHAR(3),
    awarded_by UUID NOT NULL REFERENCES showcase.users(user_id),
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(execution_id,title)
);

CREATE TABLE showcase.reward_fulfillments (
    reward_fulfillment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL UNIQUE REFERENCES showcase.awards(award_id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','fulfilled','cancelled')),
    evidence_file_id UUID REFERENCES showcase.files(file_id),
    comment TEXT,
    fulfilled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK((status='fulfilled')=(fulfilled_at IS NOT NULL))
);

CREATE TABLE showcase.certificates (
    certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    file_id UUID NOT NULL REFERENCES showcase.files(file_id),
    verification_code TEXT NOT NULL UNIQUE,
    issued_by UUID NOT NULL REFERENCES showcase.users(user_id),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    UNIQUE(execution_id,student_id)
);

CREATE TABLE showcase.student_projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES showcase.students(user_id),
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('coursework','pet_project','startup','research','hackathon','other')),
    short_description TEXT NOT NULL,
    full_description TEXT NOT NULL,
    problem_solved TEXT,
    github_url TEXT,
    product_url TEXT,
    cover_file_id UUID REFERENCES showcase.files(file_id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','moderation','revision','published','hidden','archived')),
    moderation_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ
);
CREATE INDEX student_projects_public_idx ON showcase.student_projects(status,created_at DESC,project_id DESC);

CREATE TABLE showcase.project_members (
    project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    role_name TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id,student_id)
);
CREATE TABLE showcase.student_project_directions (
    project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
    direction_id UUID NOT NULL REFERENCES showcase.directions(direction_id),
    PRIMARY KEY(project_id,direction_id)
);
CREATE TABLE showcase.student_project_technologies (
    project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
    technology_id UUID NOT NULL REFERENCES showcase.technologies(technology_id),
    PRIMARY KEY(project_id,technology_id)
);
CREATE TABLE showcase.student_project_files (
    project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
    file_id UUID NOT NULL REFERENCES showcase.files(file_id),
    kind TEXT NOT NULL DEFAULT 'asset' CHECK(kind IN ('asset','screenshot','presentation','video','documentation')),
    ordinal INTEGER NOT NULL DEFAULT 1 CHECK(ordinal > 0),
    PRIMARY KEY(project_id,file_id), UNIQUE(project_id,kind,ordinal)
);
CREATE TABLE showcase.student_project_likes (
    project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
    user_id UUID NOT NULL REFERENCES showcase.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id,user_id)
);
CREATE TABLE showcase.student_project_moderation_events (
    moderation_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
    moderator_id UUID NOT NULL REFERENCES showcase.users(user_id),
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER reward_fulfillments_set_updated_at BEFORE UPDATE ON showcase.reward_fulfillments FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();
CREATE TRIGGER student_projects_set_updated_at BEFORE UPDATE ON showcase.student_projects FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE FUNCTION showcase.check_submission_stage() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
 IF NEW.stage_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM executions e JOIN case_stages s ON s.case_id=e.case_id WHERE e.execution_id=NEW.execution_id AND s.stage_id=NEW.stage_id) THEN
   RAISE EXCEPTION 'submission stage belongs to another case';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER submissions_stage_consistency BEFORE INSERT OR UPDATE ON showcase.submissions FOR EACH ROW EXECUTE FUNCTION showcase.check_submission_stage();

CREATE FUNCTION showcase.check_criterion_score() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
DECLARE maximum NUMERIC; criterion_case UUID; submission_case UUID;
BEGIN
 SELECT max_score,case_id INTO maximum,criterion_case FROM evaluation_criteria WHERE criterion_id=NEW.criterion_id;
 SELECT e.case_id INTO submission_case FROM evaluations v JOIN submissions s ON s.submission_id=v.submission_id JOIN executions e ON e.execution_id=s.execution_id WHERE v.evaluation_id=NEW.evaluation_id;
 IF criterion_case IS DISTINCT FROM submission_case OR NEW.score>maximum THEN RAISE EXCEPTION 'criterion score is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER criterion_scores_consistency BEFORE INSERT OR UPDATE ON showcase.criterion_scores FOR EACH ROW EXECUTE FUNCTION showcase.check_criterion_score();

CREATE FUNCTION showcase.prevent_result_history_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME; END $$;
CREATE TRIGGER reviews_append_only BEFORE UPDATE OR DELETE ON showcase.reviews FOR EACH ROW EXECUTE FUNCTION showcase.prevent_result_history_change();
CREATE TRIGGER student_project_moderation_append_only BEFORE UPDATE OR DELETE ON showcase.student_project_moderation_events FOR EACH ROW EXECUTE FUNCTION showcase.prevent_result_history_change();
