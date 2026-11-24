ALTER TABLE showcase.teams
    ADD COLUMN description TEXT NOT NULL DEFAULT '',
    ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','open')),
    ADD COLUMN looking_for_members BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE showcase.cases ADD COLUMN cover_file_id UUID REFERENCES showcase.files(file_id);
ALTER TABLE showcase.student_projects
    ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
    ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(tags)='array' AND jsonb_array_length(tags)<=10);

CREATE TABLE showcase.comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL CHECK(resource_type IN ('case','student_project')),
    resource_id UUID NOT NULL,
    parent_comment_id UUID REFERENCES showcase.comments(comment_id),
    author_id UUID NOT NULL REFERENCES showcase.users(user_id),
    body TEXT NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted','hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CHECK((status='deleted')=(deleted_at IS NOT NULL))
);
CREATE INDEX comments_resource_idx ON showcase.comments(resource_type,resource_id,parent_comment_id,created_at DESC,comment_id DESC);

CREATE FUNCTION showcase.validate_comment_resource() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
DECLARE parent_row comments%ROWTYPE;
BEGIN
    IF NEW.resource_type='case' AND NOT EXISTS(SELECT 1 FROM cases WHERE case_id=NEW.resource_id AND status IN ('published','in_progress','completed') AND visibility='public') THEN
        RAISE EXCEPTION 'comment case does not exist';
    ELSIF NEW.resource_type='student_project' AND NOT EXISTS(SELECT 1 FROM student_projects WHERE project_id=NEW.resource_id AND status='published' AND visibility='public') THEN
        RAISE EXCEPTION 'comment project does not exist';
    END IF;
    IF NEW.parent_comment_id IS NOT NULL THEN
        SELECT * INTO parent_row FROM comments WHERE comment_id=NEW.parent_comment_id;
        IF NOT FOUND OR parent_row.resource_type<>NEW.resource_type OR parent_row.resource_id<>NEW.resource_id OR parent_row.parent_comment_id IS NOT NULL THEN
            RAISE EXCEPTION 'invalid comment parent';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER comments_validate BEFORE INSERT OR UPDATE OF resource_type,resource_id,parent_comment_id ON showcase.comments
FOR EACH ROW EXECUTE FUNCTION showcase.validate_comment_resource();
CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON showcase.comments FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE TABLE showcase.reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES showcase.users(user_id),
    resource_type TEXT NOT NULL CHECK(resource_type IN ('case','student_project','comment','profile')),
    resource_id UUID NOT NULL,
    reason TEXT NOT NULL CHECK(reason IN ('spam','abuse','fraud','copyright','personal_data','other')),
    details TEXT NOT NULL DEFAULT '' CHECK(length(details)<=4000),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','rejected')),
    resolution TEXT,
    moderator_id UUID REFERENCES showcase.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX reports_open_uq ON showcase.reports(reporter_id,resource_type,resource_id) WHERE status IN ('open','reviewing');
CREATE INDEX reports_queue_idx ON showcase.reports(status,created_at,report_id);
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON showcase.reports FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE FUNCTION showcase.validate_report_resource() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
    IF (NEW.resource_type='case' AND NOT EXISTS(SELECT 1 FROM cases WHERE case_id=NEW.resource_id)) OR
       (NEW.resource_type='student_project' AND NOT EXISTS(SELECT 1 FROM student_projects WHERE project_id=NEW.resource_id)) OR
       (NEW.resource_type='comment' AND NOT EXISTS(SELECT 1 FROM comments WHERE comment_id=NEW.resource_id)) OR
       (NEW.resource_type='profile' AND NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.resource_id)) THEN
        RAISE EXCEPTION 'reported resource does not exist';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER reports_validate BEFORE INSERT OR UPDATE OF resource_type,resource_id ON showcase.reports FOR EACH ROW EXECUTE FUNCTION showcase.validate_report_resource();

CREATE TABLE showcase.team_join_applications (
    join_application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES showcase.teams(team_id),
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    role_id UUID REFERENCES showcase.team_roles(team_role_id),
    resume_file_id UUID REFERENCES showcase.files(file_id),
    cover_letter TEXT NOT NULL DEFAULT '' CHECK(length(cover_letter)<=4000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX team_join_applications_pending_uq ON showcase.team_join_applications(team_id,student_id) WHERE status='pending';
CREATE INDEX team_join_applications_team_idx ON showcase.team_join_applications(team_id,status,created_at DESC);

CREATE TABLE showcase.student_team_search_profiles (
    student_id UUID PRIMARY KEY REFERENCES showcase.students(user_id),
    headline TEXT NOT NULL DEFAULT '' CHECK(length(headline)<=200),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=4000),
    resume_file_id UUID REFERENCES showcase.files(file_id),
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER student_team_search_profiles_set_updated_at BEFORE UPDATE ON showcase.student_team_search_profiles FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE TABLE showcase.case_placements (
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    place_no INTEGER CHECK(place_no>0),
    nomination TEXT,
    assigned_by UUID NOT NULL REFERENCES showcase.users(user_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(case_id,execution_id),
    CHECK(place_no IS NOT NULL OR COALESCE(length(btrim(nomination)),0)>0)
);
CREATE UNIQUE INDEX case_placements_place_uq ON showcase.case_placements(case_id,place_no) WHERE place_no IS NOT NULL;

CREATE FUNCTION showcase.validate_case_placement() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM executions WHERE execution_id=NEW.execution_id AND case_id=NEW.case_id) THEN
        RAISE EXCEPTION 'execution belongs to another case';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER case_placements_validate BEFORE INSERT OR UPDATE ON showcase.case_placements FOR EACH ROW EXECUTE FUNCTION showcase.validate_case_placement();

CREATE TABLE showcase.internship_programs (
    program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES showcase.companies(company_id),
    created_by UUID NOT NULL REFERENCES showcase.users(user_id),
    title TEXT NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
    summary TEXT NOT NULL CHECK(length(btrim(summary)) BETWEEN 1 AND 1000),
    content_markdown TEXT NOT NULL CHECK(length(btrim(content_markdown)) BETWEEN 1 AND 50000),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','moderation','revision','published','closed','hidden')),
    moderation_comment TEXT,
    application_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ
);
CREATE INDEX internship_programs_public_idx ON showcase.internship_programs(status,created_at DESC,program_id DESC);
CREATE TRIGGER internship_programs_set_updated_at BEFORE UPDATE ON showcase.internship_programs FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE TABLE showcase.student_curators (
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    curator_id UUID NOT NULL REFERENCES showcase.users(user_id),
    assigned_by UUID NOT NULL REFERENCES showcase.users(user_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY(student_id,assigned_at)
);
CREATE UNIQUE INDEX student_curators_active_uq ON showcase.student_curators(student_id) WHERE revoked_at IS NULL;

CREATE TABLE showcase.student_profile_files (
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    file_id UUID NOT NULL REFERENCES showcase.files(file_id),
    kind TEXT NOT NULL CHECK(kind IN ('resume','portfolio','certificate','other')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detached_at TIMESTAMPTZ,
    PRIMARY KEY(student_id,file_id)
);
CREATE UNIQUE INDEX student_profile_files_default_uq ON showcase.student_profile_files(student_id,kind) WHERE is_default AND detached_at IS NULL;

CREATE TABLE showcase.case_nda_versions (
    nda_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    version_no INTEGER NOT NULL CHECK(version_no>0),
    text TEXT NOT NULL CHECK(length(btrim(text)) BETWEEN 1 AND 50000),
    file_id UUID REFERENCES showcase.files(file_id),
    created_by UUID NOT NULL REFERENCES showcase.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(case_id,version_no)
);
CREATE UNIQUE INDEX case_nda_versions_current_uq ON showcase.case_nda_versions(case_id) WHERE is_current;
ALTER TABLE showcase.nda_grants
    ADD COLUMN nda_version_id UUID REFERENCES showcase.case_nda_versions(nda_version_id),
    ADD COLUMN accepted_at TIMESTAMPTZ;

CREATE FUNCTION showcase.require_current_nda_on_publish() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
    IF NEW.nda_required AND NEW.status IN ('published','in_progress','completed') AND NOT EXISTS(SELECT 1 FROM case_nda_versions WHERE case_id=NEW.case_id AND is_current) THEN
        RAISE EXCEPTION 'current NDA version is required';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER cases_require_current_nda BEFORE INSERT OR UPDATE OF status,nda_required ON showcase.cases FOR EACH ROW EXECUTE FUNCTION showcase.require_current_nda_on_publish();

CREATE FUNCTION showcase.lock_evaluation_criteria() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
DECLARE target_case UUID; target_status TEXT;
BEGIN
    IF TG_OP='DELETE' THEN target_case:=OLD.case_id; ELSE target_case:=NEW.case_id; END IF;
    SELECT status INTO target_status FROM cases WHERE case_id=target_case;
    IF target_status<>'draft' THEN RAISE EXCEPTION 'evaluation criteria are immutable after draft'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER evaluation_criteria_immutable BEFORE INSERT OR UPDATE OR DELETE ON showcase.evaluation_criteria
FOR EACH ROW EXECUTE FUNCTION showcase.lock_evaluation_criteria();

CREATE FUNCTION showcase.validate_project_tags() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.tags) tag WHERE jsonb_typeof(tag)<>'string' OR length(btrim(tag #>> '{}')) NOT BETWEEN 1 AND 40) THEN
        RAISE EXCEPTION 'invalid project tag';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER student_projects_validate_tags BEFORE INSERT OR UPDATE OF tags ON showcase.student_projects FOR EACH ROW EXECUTE FUNCTION showcase.validate_project_tags();

CREATE VIEW showcase.student_ratings AS
SELECT s.user_id AS student_id,
       round(COALESCE((SELECT avg(v.total_score/NULLIF(v.max_score,0))*70 FROM showcase.execution_members em JOIN showcase.submissions su ON su.execution_id=em.execution_id JOIN showcase.evaluations v ON v.submission_id=su.submission_id WHERE em.student_id=s.user_id AND v.status='published'),0),2) AS quality_score,
       LEAST((SELECT count(DISTINCT e.execution_id) FROM showcase.execution_members em JOIN showcase.executions e ON e.execution_id=em.execution_id WHERE em.student_id=s.user_id AND e.status IN ('done','closed')),5)*2 AS completion_score,
       LEAST((SELECT count(*) FROM showcase.student_projects p WHERE p.owner_id=s.user_id AND p.status='published'),5)*2 AS project_score,
       LEAST((SELECT count(DISTINCT a.award_id)*3 FROM showcase.execution_members em JOIN showcase.awards a ON a.execution_id=em.execution_id WHERE em.student_id=s.user_id)+(SELECT count(*)*2 FROM showcase.certificates c WHERE c.student_id=s.user_id AND c.revoked_at IS NULL),10) AS achievement_score
FROM showcase.students s;
