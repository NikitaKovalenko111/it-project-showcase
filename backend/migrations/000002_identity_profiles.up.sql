ALTER TABLE showcase.users
    ALTER COLUMN group_name DROP NOT NULL;

ALTER TABLE showcase.sessions RENAME TO auth_sessions;

CREATE TABLE showcase.students (
    user_id UUID PRIMARY KEY REFERENCES showcase.users (user_id),
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    patronymic TEXT,
    institute_name TEXT NOT NULL,
    study_direction TEXT NOT NULL,
    program_name TEXT,
    course SMALLINT NOT NULL CHECK (course BETWEEN 1 AND 8),
    group_name TEXT NOT NULL,
    phone TEXT,
    bio TEXT,
    professional_interests JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(professional_interests) = 'array'),
    competencies JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(competencies) = 'array'),
    technologies JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(technologies) = 'array'),
    links JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(links) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase.user_consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES showcase.users (user_id),
    consent_type TEXT NOT NULL,
    version TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX user_consents_user_idx
    ON showcase.user_consents (user_id, consent_type, granted_at DESC);

CREATE TABLE showcase.external_identities (
    identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES showcase.users (user_id),
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, subject)
);

CREATE INDEX external_identities_user_idx
    ON showcase.external_identities (user_id);

CREATE OR REPLACE FUNCTION showcase.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON showcase.users
FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE TRIGGER students_set_updated_at
BEFORE UPDATE ON showcase.students
FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();
