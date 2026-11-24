CREATE SCHEMA IF NOT EXISTS showcase;

CREATE TABLE showcase.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) NOT NULL,
    email VARCHAR(254) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    image_url TEXT,
    password_hash TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'blocked', 'deleted')),
    failed_login_count INTEGER NOT NULL DEFAULT 0
        CHECK (failed_login_count >= 0),
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX users_username_idx ON showcase.users (username);
CREATE UNIQUE INDEX users_email_idx ON showcase.users (email);

CREATE TABLE showcase.roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL
);

CREATE TABLE showcase.user_roles (
    user_id UUID NOT NULL REFERENCES showcase.users (user_id),
    role_id UUID NOT NULL REFERENCES showcase.roles (role_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO showcase.roles (code, name) VALUES
    ('admin', 'Администратор'),
    ('university_staff', 'Сотрудник УУНиТ'),
    ('company_representative', 'Представитель компании'),
    ('student', 'Студент'),
    ('mentor', 'Куратор / наставник')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE showcase.sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES showcase.users (user_id),
    refresh_token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX sessions_refresh_token_hash_idx
    ON showcase.sessions (refresh_token_hash);
CREATE INDEX sessions_user_id_idx
    ON showcase.sessions (user_id);
CREATE INDEX sessions_expires_at_idx
    ON showcase.sessions (expires_at);
