CREATE TABLE showcase.teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    leader_id UUID NOT NULL REFERENCES showcase.students (user_id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disbanded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase.team_members (
    team_id UUID NOT NULL REFERENCES showcase.teams (team_id),
    student_id UUID NOT NULL REFERENCES showcase.students (user_id),
    role_id UUID REFERENCES showcase.team_roles (team_role_id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMPTZ,
    PRIMARY KEY (team_id, student_id),
    CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE TABLE showcase.team_invitations (
    team_invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES showcase.teams (team_id),
    invited_by UUID NOT NULL REFERENCES showcase.students (user_id),
    student_id UUID NOT NULL REFERENCES showcase.students (user_id),
    role_id UUID REFERENCES showcase.team_roles (team_role_id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ,
    CHECK ((status = 'pending') = (responded_at IS NULL))
);

CREATE UNIQUE INDEX team_invitations_pending_uq
    ON showcase.team_invitations (team_id, student_id) WHERE status = 'pending';
CREATE INDEX team_members_student_idx ON showcase.team_members (student_id) WHERE left_at IS NULL;
CREATE INDEX team_invitations_student_idx ON showcase.team_invitations (student_id, status, created_at DESC);

CREATE TABLE showcase.applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    case_revision_id UUID NOT NULL,
    submitted_by UUID NOT NULL REFERENCES showcase.students (user_id),
    student_id UUID REFERENCES showcase.students (user_id),
    team_id UUID REFERENCES showcase.teams (team_id),
    cover_letter TEXT,
    resume_file_id UUID REFERENCES showcase.files (file_id),
    portfolio_url TEXT,
    github_url TEXT,
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('consent_pending', 'submitted', 'info_requested', 'interview', 'accepted', 'rejected', 'withdrawn')),
    company_notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((student_id IS NOT NULL) <> (team_id IS NOT NULL)),
    FOREIGN KEY (case_id, case_revision_id)
        REFERENCES showcase.case_revisions (case_id, case_revision_id),
    UNIQUE (case_id, application_id),
    UNIQUE (application_id, case_revision_id)
);

CREATE UNIQUE INDEX applications_active_student_uq ON showcase.applications (case_id, student_id)
    WHERE student_id IS NOT NULL AND status NOT IN ('rejected', 'withdrawn');
CREATE UNIQUE INDEX applications_active_team_uq ON showcase.applications (case_id, team_id)
    WHERE team_id IS NOT NULL AND status NOT IN ('rejected', 'withdrawn');
CREATE INDEX applications_case_status_idx ON showcase.applications (case_id, status, submitted_at DESC, application_id DESC);
CREATE INDEX applications_student_idx ON showcase.applications (student_id, submitted_at DESC);
CREATE INDEX applications_team_idx ON showcase.applications (team_id, submitted_at DESC);

CREATE TABLE showcase.application_consents (
    application_id UUID NOT NULL REFERENCES showcase.applications (application_id),
    student_id UUID NOT NULL REFERENCES showcase.students (user_id),
    case_revision_id UUID NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (application_id, student_id),
    FOREIGN KEY (application_id, case_revision_id)
        REFERENCES showcase.applications (application_id, case_revision_id)
);

CREATE TABLE showcase.executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    application_id UUID NOT NULL UNIQUE,
    team_id UUID REFERENCES showcase.teams (team_id),
    status TEXT NOT NULL DEFAULT 'accepted'
        CHECK (status IN ('accepted', 'in_progress', 'submitted', 'review', 'revision', 'done', 'closed', 'cancelled')),
    started_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id, application_id)
        REFERENCES showcase.applications (case_id, application_id),
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE showcase.execution_members (
    execution_id UUID NOT NULL REFERENCES showcase.executions (execution_id),
    student_id UUID NOT NULL REFERENCES showcase.students (user_id),
    role_id UUID REFERENCES showcase.team_roles (team_role_id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMPTZ,
    PRIMARY KEY (execution_id, student_id),
    CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX executions_case_status_idx ON showcase.executions (case_id, status);
CREATE INDEX execution_members_student_idx ON showcase.execution_members (student_id) WHERE left_at IS NULL;

CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON showcase.teams
FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();
CREATE TRIGGER applications_set_updated_at BEFORE UPDATE ON showcase.applications
FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE FUNCTION showcase.check_execution_application() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = showcase, pg_catalog AS $$
DECLARE application_row applications%ROWTYPE;
BEGIN
    SELECT * INTO application_row FROM applications WHERE application_id = NEW.application_id;
    IF application_row.status <> 'accepted'
       OR application_row.case_id <> NEW.case_id
       OR application_row.team_id IS DISTINCT FROM NEW.team_id THEN
        RAISE EXCEPTION 'execution must match an accepted application';
    END IF;
    IF EXISTS (
        SELECT 1 FROM execution_members member
        WHERE member.execution_id = NEW.execution_id
          AND NOT EXISTS (
              SELECT 1 FROM application_consents consent
              WHERE consent.application_id = application_row.application_id
                AND consent.student_id = member.student_id
          )
    ) THEN
        RAISE EXCEPTION 'every execution member must accept the case revision';
    END IF;
    RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER executions_application_consistency
AFTER INSERT OR UPDATE OF case_id, application_id, team_id ON showcase.executions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION showcase.check_execution_application();

CREATE FUNCTION showcase.check_execution_member_consent() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = showcase, pg_catalog AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM executions execution
        JOIN application_consents consent
          ON consent.application_id = execution.application_id
         AND consent.student_id = NEW.student_id
        WHERE execution.execution_id = NEW.execution_id
    ) THEN
        RAISE EXCEPTION 'execution member has not accepted the case revision';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER execution_members_consent_consistency
BEFORE INSERT OR UPDATE OF execution_id, student_id ON showcase.execution_members
FOR EACH ROW EXECUTE FUNCTION showcase.check_execution_member_consent();
