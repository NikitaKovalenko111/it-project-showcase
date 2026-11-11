ALTER TABLE showcase.students ADD COLUMN education_level TEXT;
CREATE TABLE showcase.role_requests (
    user_id UUID PRIMARY KEY REFERENCES showcase.users(user_id),
    role_code TEXT NOT NULL CHECK (role_code IN ('company_representative','university_staff')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by UUID REFERENCES showcase.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);
