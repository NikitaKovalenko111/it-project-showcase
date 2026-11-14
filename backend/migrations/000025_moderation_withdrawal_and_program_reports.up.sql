ALTER TABLE showcase.cases ADD COLUMN moderation_from_status TEXT
    CHECK (moderation_from_status IN ('draft', 'revision'));

ALTER TABLE showcase.feedback_messages
    DROP CONSTRAINT feedback_messages_status_check,
    ADD CONSTRAINT feedback_messages_status_check CHECK (status IN ('reviewing', 'reviewed', 'accepted', 'rejected'));

ALTER TABLE showcase.reports
    DROP CONSTRAINT reports_resource_type_check,
    ADD CONSTRAINT reports_resource_type_check CHECK (resource_type IN ('case', 'student_project', 'comment', 'profile', 'company', 'internship'));

CREATE FUNCTION showcase.validate_program_report() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
    PERFORM 1 FROM internship_programs
        WHERE program_id=NEW.resource_id AND status='published' FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'reported program is unavailable' USING ERRCODE='foreign_key_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER reports_validate_program
BEFORE INSERT OR UPDATE OF resource_type,resource_id ON showcase.reports
FOR EACH ROW WHEN (NEW.resource_type='internship')
EXECUTE FUNCTION showcase.validate_program_report();

CREATE TABLE showcase.internship_files (
    program_id UUID NOT NULL REFERENCES showcase.internship_programs(program_id),
    file_id UUID NOT NULL REFERENCES showcase.files(file_id),
    PRIMARY KEY (program_id, file_id)
);

CREATE FUNCTION showcase.can_read_program(target UUID, viewer UUID, is_admin BOOLEAN)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path=showcase,pg_catalog AS $$
    SELECT EXISTS (
        SELECT 1 FROM internship_programs p WHERE p.program_id=target AND (
            is_admin OR p.status='published'
            OR EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=p.company_id AND m.user_id=viewer AND m.status='active')
            OR (p.status='moderation' AND EXISTS(
                SELECT 1 FROM user_roles ur JOIN roles r USING (role_id) JOIN users u ON u.user_id=ur.user_id
                WHERE ur.user_id=viewer AND u.status='active' AND r.code='university_staff'))
        )
    )
$$;
