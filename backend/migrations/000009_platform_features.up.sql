CREATE TABLE showcase.case_favorites (
 user_id UUID NOT NULL REFERENCES showcase.users(user_id), case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,case_id)
);
CREATE INDEX case_favorites_list_idx ON showcase.case_favorites(user_id,created_at DESC,case_id DESC);
CREATE TABLE showcase.student_project_favorites (
 user_id UUID NOT NULL REFERENCES showcase.users(user_id), project_id UUID NOT NULL REFERENCES showcase.student_projects(project_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,project_id)
);
CREATE INDEX project_favorites_list_idx ON showcase.student_project_favorites(user_id,created_at DESC,project_id DESC);

CREATE TABLE showcase.notifications (
 notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES showcase.users(user_id),
 type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, resource_type TEXT, resource_id UUID,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, read_at TIMESTAMPTZ
);
CREATE INDEX notifications_user_list_idx ON showcase.notifications(user_id,created_at DESC,notification_id DESC);
CREATE INDEX notifications_unread_idx ON showcase.notifications(user_id,created_at DESC) WHERE read_at IS NULL;

CREATE TABLE showcase.audit_logs (
 audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID REFERENCES showcase.users(user_id), request_id TEXT,
 action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID, old_data JSONB, new_data JSONB,
 ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_logs_list_idx ON showcase.audit_logs(created_at DESC,audit_id DESC);
CREATE INDEX audit_logs_entity_idx ON showcase.audit_logs(entity_type,entity_id,created_at DESC);

CREATE TABLE showcase.portfolio_settings (
 student_id UUID PRIMARY KEY REFERENCES showcase.students(user_id), visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private')),
 headline TEXT, about TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER portfolio_settings_updated_at BEFORE UPDATE ON showcase.portfolio_settings FOR EACH ROW EXECUTE FUNCTION showcase.set_updated_at();

CREATE TABLE showcase.email_outbox (
 email_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES showcase.users(user_id), notification_id UUID REFERENCES showcase.notifications(notification_id),
 recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMPTZ
);
CREATE INDEX email_outbox_pending_idx ON showcase.email_outbox(next_attempt_at,created_at) WHERE status IN ('pending','failed');

CREATE FUNCTION showcase.enqueue_notification_email() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN
 INSERT INTO email_outbox(user_id,notification_id,recipient,subject,body)
 SELECT NEW.user_id,NEW.notification_id,u.email,NEW.title,NEW.body FROM users u WHERE u.user_id=NEW.user_id AND u.status='active';
 RETURN NEW;
END $$;
CREATE TRIGGER notifications_email_outbox AFTER INSERT ON showcase.notifications FOR EACH ROW EXECUTE FUNCTION showcase.enqueue_notification_email();

CREATE FUNCTION showcase.notify_team_invitation() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN INSERT INTO notifications(user_id,type,title,body,resource_type,resource_id) VALUES(NEW.student_id,'team_invitation','Приглашение в команду','Вас пригласили присоединиться к команде','team_invitation',NEW.team_invitation_id); RETURN NEW; END $$;
CREATE TRIGGER team_invitation_notify AFTER INSERT ON showcase.team_invitations FOR EACH ROW EXECUTE FUNCTION showcase.notify_team_invitation();
CREATE FUNCTION showcase.notify_company_invitation() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN INSERT INTO notifications(user_id,type,title,body,resource_type,resource_id) VALUES(NEW.student_id,'company_invitation','Приглашение от компании',COALESCE(NEW.message,'Компания отправила вам приглашение'),'company_invitation',NEW.company_invitation_id); RETURN NEW; END $$;
CREATE TRIGGER company_invitation_notify AFTER INSERT ON showcase.company_invitations FOR EACH ROW EXECUTE FUNCTION showcase.notify_company_invitation();
CREATE FUNCTION showcase.notify_company_member_invitation() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
BEGIN INSERT INTO notifications(user_id,type,title,body,resource_type,resource_id) VALUES(NEW.user_id,'company_member_invitation','Приглашение в компанию','Вас пригласили стать представителем компании','company_member_invitation',NEW.invitation_id); RETURN NEW; END $$;
CREATE TRIGGER company_member_invitation_notify AFTER INSERT ON showcase.company_member_invitations FOR EACH ROW EXECUTE FUNCTION showcase.notify_company_member_invitation();

CREATE FUNCTION showcase.audit_row_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=showcase,pg_catalog AS $$
DECLARE rid UUID; oldj JSONB; newj JSONB;
BEGIN oldj:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END; newj:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 IF TG_ARGV[1]='user' THEN oldj:=oldj-'password_hash'; newj:=newj-'password_hash'; END IF;
 rid:=COALESCE((newj->>TG_ARGV[0])::uuid,(oldj->>TG_ARGV[0])::uuid);
 INSERT INTO audit_logs(action,entity_type,entity_id,old_data,new_data) VALUES(lower(TG_OP),TG_ARGV[1],rid,oldj,newj);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER users_audit AFTER UPDATE ON showcase.users FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('user_id','user');
CREATE TRIGGER companies_audit AFTER INSERT OR UPDATE ON showcase.companies FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('company_id','company');
CREATE TRIGGER cases_audit AFTER INSERT OR UPDATE ON showcase.cases FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('case_id','case');
CREATE TRIGGER applications_audit AFTER INSERT OR UPDATE ON showcase.applications FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('application_id','application');
CREATE TRIGGER submissions_audit AFTER INSERT OR UPDATE ON showcase.submissions FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('submission_id','submission');
CREATE TRIGGER student_projects_audit AFTER INSERT OR UPDATE ON showcase.student_projects FOR EACH ROW EXECUTE FUNCTION showcase.audit_row_change('project_id','student_project');

INSERT INTO showcase.notifications(user_id,type,title,body,resource_type,resource_id,created_at)
SELECT student_id,'company_invitation','Приглашение от компании',COALESCE(message,'Компания отправила вам приглашение'),'company_invitation',company_invitation_id,sent_at
FROM showcase.company_invitations WHERE status='sent';
