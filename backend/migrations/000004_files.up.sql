CREATE TABLE showcase.files (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    checksum_sha256 TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES showcase.users (user_id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CHECK ((status = 'active' AND deleted_at IS NULL) OR (status = 'deleted' AND deleted_at IS NOT NULL))
);

CREATE INDEX files_uploaded_by_idx ON showcase.files (uploaded_by, created_at DESC);

ALTER TABLE showcase.companies
    ADD CONSTRAINT companies_logo_file_fk
    FOREIGN KEY (logo_file_id) REFERENCES showcase.files (file_id);

ALTER TABLE showcase.students
    ADD COLUMN photo_file_id UUID REFERENCES showcase.files (file_id);
