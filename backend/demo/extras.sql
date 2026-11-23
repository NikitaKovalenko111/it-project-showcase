\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=showcase,public;
DO $$
DECLARE
    listing uuid;
    author uuid;
    captain uuid;
    teammate uuid;
    pending_team uuid;
    pending_application uuid;
BEGIN
    IF current_database()<>'showcase_demo' OR current_user<>'showcase_demo' THEN
        RAISE EXCEPTION 'Use the isolated showcase_demo database and role';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('showcase-demo-seed-v1'));
    UPDATE students s SET institute_name='Институт информатики, математики и робототехники' WHERE s.institute_name='ИИМРТ'
        AND EXISTS (SELECT 1 FROM users u WHERE u.user_id=s.user_id AND u.username IN ('demo.student1', 'demo.student2', 'demo.student3', 'demo.student4', 'demo.student5', 'demo.student6', 'demo.student7', 'demo.student8', 'demo.student9', 'demo.student10', 'demo.student11', 'demo.student12'));
    SELECT case_id,created_by INTO STRICT listing,author FROM cases WHERE title='Мониторинг телеметрии компрессорной станции';
    INSERT INTO case_nda_versions(case_id,version_no,text,created_by)
    VALUES (listing,1,'Учебное NDA. Используйте только синтетические данные. Материалы предназначены для проверки сценария доступа.',author)
    ON CONFLICT(case_id,version_no) DO NOTHING;
    UPDATE cases SET nda_required=true WHERE case_id=listing AND NOT nda_required;
    INSERT INTO users(username,email,password_hash,status)
    SELECT 'demo.blocked','blocked@showcase.example.test',password_hash,'blocked' FROM users WHERE username='demo.admin'
    ON CONFLICT(username) DO NOTHING;
    SELECT user_id INTO STRICT captain FROM users WHERE username='demo.student5';
    SELECT user_id INTO STRICT teammate FROM users WHERE username='demo.student6';
    IF NOT EXISTS (SELECT 1 FROM teams WHERE leader_id=captain AND name='Сетевой десант') THEN
        INSERT INTO teams(name,leader_id,description,visibility)
        VALUES ('Сетевой десант',captain,'Учебная команда. Второму участнику нужно подтвердить условия кейса.','private')
        RETURNING team_id INTO pending_team;
        INSERT INTO team_members(team_id,student_id) VALUES (pending_team,captain),(pending_team,teammate);
        INSERT INTO applications(case_id,case_revision_id,submitted_by,team_id,status,cover_letter)
        SELECT c.case_id,cr.case_revision_id,captain,pending_team,'consent_pending','Готовы проверить алгоритм на разных нагрузках.'
        FROM cases c JOIN case_revisions cr ON cr.case_id=c.case_id AND cr.version_no=c.terms_version
        WHERE c.title='Планирование маршрутов выездных бригад'
        RETURNING application_id INTO pending_application;
        INSERT INTO application_consents(application_id,student_id,case_revision_id)
        SELECT application_id,captain,case_revision_id FROM applications WHERE application_id=pending_application;
    END IF;
    INSERT INTO reward_fulfillments(award_id,comment)
    SELECT award_id,'Учебная награда ожидает подтверждения.' FROM awards WHERE title='Лучший учебный отчёт'
    ON CONFLICT(award_id) DO NOTHING;
END $$;
COMMIT;
