CREATE OR REPLACE FUNCTION showcase.audit_row_change() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
DECLARE
    row_id uuid;
    old_row jsonb;
    new_row jsonb;
    actor uuid := NULLIF(current_setting('showcase.audit_actor', true), '')::uuid;
    request_ref text := NULLIF(current_setting('showcase.audit_request', true), '');
    reason text := NULLIF(current_setting('showcase.audit_reason', true), '');
BEGIN
    IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
    IF TG_ARGV[1] = 'user' THEN
        old_row := old_row - 'password_hash';
        new_row := new_row - 'password_hash';
        -- Authentication bookkeeping is separate from changes to the account.
        IF TG_OP = 'UPDATE' AND
            old_row - ARRAY['updated_at','last_login_at','failed_login_count','locked_until'] =
            new_row - ARRAY['updated_at','last_login_at','failed_login_count','locked_until'] THEN
            RETURN NEW;
        END IF;
        IF reason IS NOT NULL THEN
            new_row := new_row || jsonb_build_object('status_reason', reason);
        END IF;
    END IF;
    row_id := COALESCE((new_row->>TG_ARGV[0])::uuid, (old_row->>TG_ARGV[0])::uuid);
    INSERT INTO audit_logs(actor_id, request_id, action, entity_type, entity_id, old_data, new_data)
    VALUES ((SELECT user_id FROM users WHERE user_id=actor), request_ref,
            lower(TG_OP), TG_ARGV[1], row_id, old_row, new_row);
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER role_requests_audit AFTER UPDATE ON showcase.role_requests
FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('user_id','role_request');
