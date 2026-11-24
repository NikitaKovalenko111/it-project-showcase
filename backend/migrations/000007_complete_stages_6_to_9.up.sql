ALTER TABLE showcase.companies DROP CONSTRAINT companies_status_check;
ALTER TABLE showcase.companies ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE showcase.companies ADD CONSTRAINT companies_status_check
    CHECK (status IN ('draft','pending','approved','rejected','suspended'));

CREATE TABLE showcase.company_member_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES showcase.companies(company_id),
    invited_by UUID NOT NULL REFERENCES showcase.users(user_id),
    user_id UUID NOT NULL REFERENCES showcase.users(user_id),
    position TEXT,
    permissions JSONB NOT NULL DEFAULT '["manage_company"]'::jsonb CHECK(jsonb_typeof(permissions)='array'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ,
    CHECK ((status='pending')=(responded_at IS NULL))
);
CREATE UNIQUE INDEX company_member_invitations_pending_uq ON showcase.company_member_invitations(company_id,user_id) WHERE status='pending';

CREATE TABLE showcase.company_invitations (
    company_invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES showcase.companies(company_id),
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    case_id UUID REFERENCES showcase.cases(case_id),
    kind TEXT NOT NULL CHECK(kind IN ('case','internship','interview','job')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','accepted','declined','expired','revoked')),
    message TEXT,
    sent_by UUID NOT NULL REFERENCES showcase.users(user_id),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);
CREATE INDEX company_invitations_student_idx ON showcase.company_invitations(student_id,status,sent_at DESC);

CREATE TABLE showcase.evaluation_criteria (
    criterion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    name TEXT NOT NULL,
    weight NUMERIC(7,4) NOT NULL CHECK(weight>0),
    max_score NUMERIC(10,2) NOT NULL CHECK(max_score>0),
    ordinal INTEGER NOT NULL CHECK(ordinal>0),
    UNIQUE(case_id,ordinal)
);

CREATE TABLE showcase.execution_mentors (
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    user_id UUID NOT NULL REFERENCES showcase.users(user_id),
    role_name TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(execution_id,user_id)
);

CREATE TABLE showcase.case_stages (
    stage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    ordinal INTEGER NOT NULL CHECK(ordinal>0),
    title TEXT NOT NULL,
    expected_result TEXT,
    due_at TIMESTAMPTZ,
    UNIQUE(case_id,ordinal), UNIQUE(case_id,stage_id)
);

CREATE TABLE showcase.execution_stages (
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    stage_id UUID NOT NULL REFERENCES showcase.case_stages(stage_id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','submitted','accepted','revision')),
    feedback TEXT,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(execution_id,stage_id)
);

CREATE TABLE showcase.execution_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    stage_id UUID REFERENCES showcase.case_stages(stage_id),
    author_id UUID NOT NULL REFERENCES showcase.users(user_id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX execution_comments_list_idx ON showcase.execution_comments(execution_id,created_at DESC,comment_id DESC);

CREATE TABLE showcase.nda_grants (
    nda_grant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','granted','revoked','rejected')),
    granted_at TIMESTAMPTZ,
    evidence_file_id UUID REFERENCES showcase.files(file_id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(status<>'granted' OR granted_at IS NOT NULL)
);
CREATE UNIQUE INDEX nda_grants_current_uq ON showcase.nda_grants(case_id,student_id) WHERE status IN ('pending','granted');

CREATE TRIGGER execution_stages_set_updated_at BEFORE UPDATE ON showcase.execution_stages FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();
CREATE TRIGGER nda_grants_set_updated_at BEFORE UPDATE ON showcase.nda_grants FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE FUNCTION showcase.check_execution_stage_case() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
DECLARE execution_case UUID; stage_case UUID;
BEGIN
    SELECT case_id INTO execution_case FROM executions WHERE execution_id=NEW.execution_id;
    SELECT case_id INTO stage_case FROM case_stages WHERE stage_id=NEW.stage_id;
    IF execution_case IS DISTINCT FROM stage_case THEN RAISE EXCEPTION 'stage and execution belong to different cases'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER execution_stages_case_consistency BEFORE INSERT OR UPDATE ON showcase.execution_stages FOR EACH ROW EXECUTE FUNCTION showcase.check_execution_stage_case();
CREATE TRIGGER execution_comments_case_consistency BEFORE INSERT OR UPDATE ON showcase.execution_comments FOR EACH ROW WHEN (NEW.stage_id IS NOT NULL) EXECUTE FUNCTION showcase.check_execution_stage_case();

INSERT INTO showcase.execution_stages(execution_id,stage_id)
SELECT e.execution_id,s.stage_id FROM showcase.executions e JOIN showcase.case_stages s ON s.case_id=e.case_id ON CONFLICT DO NOTHING;
