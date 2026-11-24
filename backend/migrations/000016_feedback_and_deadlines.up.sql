CREATE TABLE showcase.feedback_messages (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES showcase.users(user_id),
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'reviewing' CHECK (status IN ('reviewing','accepted','rejected')),
    moderator_id UUID REFERENCES showcase.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX feedback_messages_author_idx ON showcase.feedback_messages(author_id,created_at DESC,feedback_id DESC);
CREATE INDEX feedback_messages_queue_idx ON showcase.feedback_messages(status,created_at DESC,feedback_id DESC);

CREATE TABLE showcase.feedback_files (
    feedback_id UUID NOT NULL REFERENCES showcase.feedback_messages(feedback_id),
    file_id UUID NOT NULL REFERENCES showcase.files(file_id),
    ordinal SMALLINT NOT NULL CHECK (ordinal BETWEEN 1 AND 5),
    PRIMARY KEY (feedback_id,file_id),
    UNIQUE (feedback_id,ordinal)
);

CREATE TABLE showcase.case_deadline_changes (
    change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    stage_id UUID,
    changed_by UUID NOT NULL REFERENCES showcase.users(user_id),
    previous_due_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX case_deadline_changes_case_idx ON showcase.case_deadline_changes(case_id,changed_at DESC,change_id DESC);
