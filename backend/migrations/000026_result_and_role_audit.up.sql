ALTER TABLE showcase.submission_files
    ADD COLUMN detached_at TIMESTAMPTZ,
    ADD COLUMN detached_by UUID REFERENCES showcase.users(user_id),
    ADD CONSTRAINT submission_files_detachment_check CHECK ((detached_at IS NULL) = (detached_by IS NULL));

CREATE TRIGGER user_roles_audit AFTER INSERT OR DELETE ON showcase.user_roles
FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('user_id','user_role');
