ALTER TABLE showcase.cases
    ADD COLUMN event_format TEXT NOT NULL DEFAULT 'case'
        CHECK (event_format IN ('case', 'hackathon', 'olympiad'));

CREATE INDEX cases_event_format_idx
    ON showcase.cases (event_format, status, created_at DESC, case_id DESC);

COMMENT ON COLUMN showcase.cases.event_format IS
    'Формат задания компании: обычный кейс, хакатон или олимпиада. Не связан с категорией студенческого проекта.';
