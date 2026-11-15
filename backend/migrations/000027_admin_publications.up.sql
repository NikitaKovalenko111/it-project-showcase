CREATE FUNCTION showcase.is_active_admin(actor UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path=showcase,pg_catalog AS $$
    SELECT EXISTS (
        SELECT 1 FROM users u JOIN user_roles ur USING (user_id) JOIN roles r USING (role_id)
        WHERE u.user_id=actor AND u.status='active' AND r.code='admin'
    )
$$;

CREATE TRIGGER internship_programs_audit AFTER INSERT OR UPDATE ON showcase.internship_programs
FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('program_id','internship');

CREATE TRIGGER event_plans_audit AFTER INSERT OR UPDATE ON showcase.event_plans
FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('case_id','event_plan');

CREATE TRIGGER case_stages_audit AFTER INSERT OR UPDATE OR DELETE ON showcase.case_stages
FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('stage_id','case_stage');
