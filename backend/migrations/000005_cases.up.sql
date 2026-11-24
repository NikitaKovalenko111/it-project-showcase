CREATE TABLE showcase.cases (
    case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES showcase.companies (company_id),
    created_by UUID NOT NULL REFERENCES showcase.users (user_id),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    full_brief TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('educational', 'contest', 'paid', 'other_reward')),
    difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    work_format TEXT NOT NULL CHECK (work_format IN ('remote', 'onsite', 'hybrid')),
    participation_mode TEXT NOT NULL CHECK (participation_mode IN ('individual', 'team', 'both')),
    admission_mode TEXT NOT NULL CHECK (admission_mode IN ('open', 'selection', 'test', 'invitation')),
    capacity INTEGER CHECK (capacity > 0),
    team_size_min INTEGER CHECK (team_size_min > 0),
    team_size_max INTEGER CHECK (team_size_max > 0),
    course_min SMALLINT CHECK (course_min BETWEEN 1 AND 8),
    course_max SMALLINT CHECK (course_max BETWEEN 1 AND 8),
    application_deadline TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    duration TEXT,
    result_requirements TEXT NOT NULL,
    evaluation_rules TEXT,
    ip_terms TEXT NOT NULL,
    terms_version INTEGER NOT NULL DEFAULT 1 CHECK (terms_version > 0),
    nda_required BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'moderation', 'revision', 'published', 'in_progress', 'completed', 'cancelled', 'hidden')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'restricted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (team_size_min IS NULL OR team_size_max IS NULL OR team_size_min <= team_size_max),
    CHECK (course_min IS NULL OR course_max IS NULL OR course_min <= course_max),
    CHECK (application_deadline IS NULL OR due_at IS NULL OR application_deadline <= due_at)
);

CREATE TABLE showcase.case_revisions (
    case_revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    brief_snapshot JSONB NOT NULL CHECK (jsonb_typeof(brief_snapshot) = 'object'),
    ip_terms_snapshot TEXT NOT NULL,
    reward_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reward_snapshot) = 'array'),
    created_by UUID NOT NULL REFERENCES showcase.users (user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (case_id, version_no),
    UNIQUE (case_id, case_revision_id)
);

CREATE TABLE showcase.case_directions (
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    direction_id UUID NOT NULL REFERENCES showcase.directions (direction_id),
    PRIMARY KEY (case_id, direction_id)
);

CREATE TABLE showcase.case_competencies (
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    competency_id UUID NOT NULL REFERENCES showcase.competencies (competency_id),
    required_level TEXT,
    PRIMARY KEY (case_id, competency_id)
);

CREATE TABLE showcase.case_technologies (
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    technology_id UUID NOT NULL REFERENCES showcase.technologies (technology_id),
    PRIMARY KEY (case_id, technology_id)
);

CREATE TABLE showcase.case_rewards (
    case_reward_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    kind TEXT NOT NULL CHECK (kind IN ('money', 'prize', 'internship', 'interview', 'job', 'training', 'gift', 'certificate', 'other')),
    description TEXT NOT NULL,
    conditions TEXT,
    amount NUMERIC(14,2) CHECK (amount >= 0),
    currency CHAR(3),
    prize_fund NUMERIC(14,2) CHECK (prize_fund >= 0),
    CHECK ((amount IS NULL AND prize_fund IS NULL) OR currency IS NOT NULL)
);

CREATE TABLE showcase.prize_places (
    prize_place_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_reward_id UUID NOT NULL REFERENCES showcase.case_rewards (case_reward_id),
    place_no INTEGER CHECK (place_no > 0),
    nomination TEXT,
    amount NUMERIC(14,2) CHECK (amount >= 0),
    CHECK (place_no IS NOT NULL OR nomination IS NOT NULL)
);

CREATE TABLE showcase.case_files (
    case_id UUID NOT NULL REFERENCES showcase.cases (case_id),
    file_id UUID NOT NULL REFERENCES showcase.files (file_id),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'participants', 'company')),
    PRIMARY KEY (case_id, file_id)
);

CREATE TABLE showcase.case_moderation_events (
    case_moderation_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    case_revision_id UUID NOT NULL,
    moderator_id UUID NOT NULL REFERENCES showcase.users (user_id),
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approve', 'request_revision', 'reject', 'hide')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id, case_revision_id)
        REFERENCES showcase.case_revisions (case_id, case_revision_id)
);

CREATE INDEX cases_public_list_idx ON showcase.cases (status, created_at DESC, case_id DESC);
CREATE INDEX cases_company_idx ON showcase.cases (company_id, status);
CREATE INDEX case_directions_direction_idx ON showcase.case_directions (direction_id);
CREATE INDEX case_competencies_competency_idx ON showcase.case_competencies (competency_id);
CREATE INDEX case_technologies_technology_idx ON showcase.case_technologies (technology_id);
CREATE INDEX case_rewards_case_idx ON showcase.case_rewards (case_id);
CREATE INDEX prize_places_reward_idx ON showcase.prize_places (case_reward_id);
CREATE UNIQUE INDEX prize_places_number_uq
    ON showcase.prize_places (case_reward_id, place_no) WHERE place_no IS NOT NULL;
CREATE INDEX case_files_file_idx ON showcase.case_files (file_id);
CREATE INDEX case_moderation_history_idx ON showcase.case_moderation_events (case_id, created_at DESC);

CREATE TRIGGER cases_set_updated_at
BEFORE UPDATE ON showcase.cases
FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE FUNCTION showcase.prevent_case_history_change() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = showcase, pg_catalog AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

CREATE TRIGGER case_revisions_append_only
BEFORE UPDATE OR DELETE ON showcase.case_revisions
FOR EACH ROW EXECUTE FUNCTION showcase.prevent_case_history_change();

CREATE TRIGGER case_moderation_events_append_only
BEFORE UPDATE OR DELETE ON showcase.case_moderation_events
FOR EACH ROW EXECUTE FUNCTION showcase.prevent_case_history_change();

CREATE FUNCTION showcase.check_case_reward_fund() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = showcase, pg_catalog AS $$
DECLARE
    reward_id UUID;
    fund NUMERIC(14,2);
    allocated NUMERIC(14,2);
BEGIN
    IF TG_OP = 'DELETE' THEN reward_id := OLD.case_reward_id;
    ELSE reward_id := NEW.case_reward_id;
    END IF;
    SELECT prize_fund INTO fund FROM case_rewards WHERE case_reward_id = reward_id;
    IF fund IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0) INTO allocated FROM prize_places WHERE case_reward_id = reward_id;
        IF allocated > fund THEN RAISE EXCEPTION 'prize places exceed reward fund'; END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER prize_places_fund_limit
AFTER INSERT OR UPDATE OR DELETE ON showcase.prize_places
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION showcase.check_case_reward_fund();

CREATE CONSTRAINT TRIGGER case_rewards_fund_limit
AFTER UPDATE OF prize_fund ON showcase.case_rewards
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION showcase.check_case_reward_fund();

CREATE FUNCTION showcase.check_case_publication() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = showcase, pg_catalog AS $$
BEGIN
    IF NEW.status IN ('published', 'in_progress', 'completed') THEN
        IF NOT EXISTS (
            SELECT 1 FROM companies
            WHERE company_id = NEW.company_id AND status = 'approved'
        ) THEN
            RAISE EXCEPTION 'publishing requires an approved company';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM case_revisions
            WHERE case_id = NEW.case_id AND version_no = NEW.terms_version
        ) THEN
            RAISE EXCEPTION 'publishing requires the current immutable revision';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM case_moderation_events event
            JOIN case_revisions revision
              ON revision.case_revision_id = event.case_revision_id
            WHERE event.case_id = NEW.case_id
              AND revision.version_no = NEW.terms_version
              AND event.decision = 'approve'
        ) THEN
            RAISE EXCEPTION 'publishing requires approval of the current revision';
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER cases_publication_consistency
AFTER INSERT OR UPDATE OF status, company_id, terms_version ON showcase.cases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION showcase.check_case_publication();
