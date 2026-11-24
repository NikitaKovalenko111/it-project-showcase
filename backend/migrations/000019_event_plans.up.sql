CREATE TABLE showcase.event_plans (
    case_id UUID PRIMARY KEY REFERENCES showcase.cases(case_id),
    plan JSONB NOT NULL CHECK (jsonb_typeof(plan)='object')
);

ALTER TABLE showcase.case_deadline_changes ADD COLUMN round_id UUID;

CREATE TABLE showcase.event_round_submissions (
    execution_id UUID NOT NULL REFERENCES showcase.executions(execution_id),
    round_id UUID NOT NULL,
    submitted_by UUID NOT NULL REFERENCES showcase.students(user_id),
    solutions JSONB NOT NULL CHECK (jsonb_typeof(solutions)='array'),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scores JSONB CHECK (jsonb_typeof(scores)='array'),
    total_score NUMERIC,
    max_score NUMERIC,
    evaluated_by UUID REFERENCES showcase.users(user_id),
    evaluated_at TIMESTAMPTZ,
    PRIMARY KEY (execution_id,round_id)
);

CREATE FUNCTION showcase.can_read_event_tasks(target UUID,viewer UUID,is_admin BOOLEAN,opens_at TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path=showcase,pg_catalog AS $$
    SELECT EXISTS (
        SELECT 1 FROM cases c WHERE c.case_id=target AND (
            is_admin OR EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=c.company_id AND m.user_id=viewer
                AND m.status='active' AND m.permissions ? 'manage_company')
            OR (opens_at<=statement_timestamp() AND c.status IN ('published','in_progress','completed') AND EXISTS(
                SELECT 1 FROM executions e JOIN execution_members m ON m.execution_id=e.execution_id AND m.left_at IS NULL
                WHERE e.case_id=target AND e.status<>'cancelled' AND m.student_id=viewer
                AND (NOT c.nda_required OR EXISTS(SELECT 1 FROM nda_grants n
                    WHERE n.case_id=target AND n.student_id=viewer AND n.status='granted'))
            ))
        )
    )
$$;
