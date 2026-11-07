CREATE TABLE showcase.directions (
    direction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase.competencies (
    competency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase.technologies (
    technology_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    kind TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase.team_roles (
    team_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase.companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    short_name TEXT,
    industry TEXT,
    description TEXT,
    activities TEXT,
    website TEXT,
    contacts TEXT,
    logo_file_id UUID,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX companies_full_name_idx ON showcase.companies (LOWER(full_name));
CREATE INDEX companies_public_list_idx ON showcase.companies (status, created_at DESC, company_id DESC);

CREATE TABLE showcase.company_members (
    company_id UUID NOT NULL REFERENCES showcase.companies (company_id),
    user_id UUID NOT NULL REFERENCES showcase.users (user_id),
    position TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions) = 'array'),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id, user_id)
);

CREATE INDEX company_members_user_idx ON showcase.company_members (user_id, status);

CREATE TABLE showcase.moderation_events (
    moderation_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES showcase.companies (company_id),
    moderator_id UUID NOT NULL REFERENCES showcase.users (user_id),
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX moderation_events_company_idx
    ON showcase.moderation_events (company_id, created_at DESC);

CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON showcase.companies
FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

INSERT INTO showcase.directions (name) VALUES
    ('Backend'), ('Frontend'), ('Fullstack'), ('Мобильная разработка'),
    ('Искусственный интеллект'), ('Машинное обучение'), ('Data Science'),
    ('Big Data'), ('DevOps'), ('Информационная безопасность'),
    ('Робототехника'), ('Компьютерное зрение'), ('Системное программирование'),
    ('Базы данных'), ('Тестирование'), ('UX/UI'), ('Бизнес-анализ'),
    ('Системный анализ'), ('Разработка игр'), ('AR/VR'), ('IoT'),
    ('Автоматизация'), ('Облачные технологии'), ('Другое ИТ-направление')
ON CONFLICT (name) DO NOTHING;

INSERT INTO showcase.team_roles (name) VALUES
    ('Team Lead'), ('Backend Developer'), ('Frontend Developer'),
    ('Mobile Developer'), ('Data Scientist'), ('ML Engineer'),
    ('DevOps Engineer'), ('QA Engineer'), ('Designer'), ('Analyst'),
    ('Project Manager'), ('Другая роль')
ON CONFLICT (name) DO NOTHING;
