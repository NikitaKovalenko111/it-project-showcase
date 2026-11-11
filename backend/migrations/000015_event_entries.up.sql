ALTER TABLE showcase.applications ADD COLUMN entry_kind TEXT NOT NULL DEFAULT 'application'
    CHECK (entry_kind IN ('application', 'registration'));
CREATE INDEX applications_event_registrations_idx ON showcase.applications (case_id)
    WHERE entry_kind = 'registration' AND status = 'accepted';
