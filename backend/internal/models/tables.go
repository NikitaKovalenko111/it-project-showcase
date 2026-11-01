package models

const (
	USERS_TABLE = `
		CREATE TABLE IF NOT EXISTS users (
			user_id UUID PRIMARY KEY,
			username VARCHAR NOT NULL,
			email VARCHAR NOT NULL,
			group_name VARCHAR NOT NULL,
			image_url VARCHAR,
			password_hash VARCHAR NOT NULL,
			status VARCHAR NOT NULL DEFAULT 'active'
				CHECK (status IN ('active', 'blocked', 'deleted')),
			failed_login_count INTEGER NOT NULL DEFAULT 0
				CHECK (failed_login_count >= 0),
			locked_until TIMESTAMPTZ,
			last_login_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`

	SESSIONS_TABLE = `
		CREATE TABLE IF NOT EXISTS sessions (
			session_id UUID PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
			refresh_token_hash VARCHAR(64) NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			revoked_at TIMESTAMPTZ
		);`
)

const (
	USERS_USERNAME_INDEX = `
		CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx
		ON users (username);`

	USERS_EMAIL_INDEX = `
		CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx
		ON users (email);`

	SESSIONS_REFRESH_TOKEN_HASH_INDEX = `
		CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_token_hash_idx
		ON sessions (refresh_token_hash);`

	SESSIONS_USER_ID_INDEX = `
		CREATE INDEX IF NOT EXISTS sessions_user_id_idx
		ON sessions (user_id);`

	SESSIONS_EXPIRES_AT_INDEX = `
		CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
		ON sessions (expires_at);`
)
