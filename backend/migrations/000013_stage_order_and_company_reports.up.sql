ALTER TABLE showcase.case_stages
    DROP CONSTRAINT case_stages_case_id_ordinal_key,
    ADD CONSTRAINT case_stages_case_id_ordinal_key UNIQUE (case_id, ordinal) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE showcase.reports
    DROP CONSTRAINT reports_resource_type_check,
    ADD CONSTRAINT reports_resource_type_check CHECK (resource_type IN ('case', 'student_project', 'comment', 'profile', 'company'));

CREATE OR REPLACE FUNCTION showcase.validate_report_resource() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
    IF (NEW.resource_type='case' AND NOT EXISTS(SELECT 1 FROM cases WHERE case_id=NEW.resource_id)) OR
       (NEW.resource_type='student_project' AND NOT EXISTS(SELECT 1 FROM student_projects WHERE project_id=NEW.resource_id)) OR
       (NEW.resource_type='comment' AND NOT EXISTS(SELECT 1 FROM comments WHERE comment_id=NEW.resource_id)) OR
       (NEW.resource_type='profile' AND NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.resource_id)) OR
       (NEW.resource_type='company' AND NOT EXISTS(SELECT 1 FROM companies WHERE company_id=NEW.resource_id AND status='approved')) THEN
        RAISE EXCEPTION 'reported resource does not exist' USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TABLE showcase.comment_likes (
    comment_id UUID NOT NULL REFERENCES showcase.comments (comment_id),
    user_id UUID NOT NULL REFERENCES showcase.users (user_id),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX team_join_applications_student_page_idx
    ON showcase.team_join_applications (student_id, created_at DESC, join_application_id DESC);
