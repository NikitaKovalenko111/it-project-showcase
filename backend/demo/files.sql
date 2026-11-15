\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=showcase,public;
DO $$
DECLARE
    student uuid;
    attachment uuid;
    resume uuid;
    cover uuid;
BEGIN
    IF current_database()<>'showcase_demo' OR current_user<>'showcase_demo' THEN
        RAISE EXCEPTION 'Use the isolated showcase_demo database and role';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('showcase-demo-seed-v1'));
    SELECT user_id INTO STRICT student FROM users WHERE username='demo.student1';
    SELECT file_id INTO STRICT attachment FROM files WHERE uploaded_by=student AND original_name='demo-result.txt' AND status='active';
    SELECT file_id INTO STRICT resume FROM files WHERE uploaded_by=student AND original_name='demo-resume.pdf' AND status='active';
    SELECT file_id INTO STRICT cover FROM files WHERE uploaded_by=student AND original_name='demo-cover.png' AND status='active';

    INSERT INTO submission_files(submission_id,file_id,kind,ordinal)
    SELECT submission_id,attachment,'documentation',1 FROM submissions
    WHERE submitted_by=student AND title IN ('Прототип маршрутизации','Итоговый отчёт')
    ON CONFLICT DO NOTHING;
    INSERT INTO student_profile_files(student_id,file_id,kind,is_default,visibility)
    VALUES (student,resume,'resume',true,'private') ON CONFLICT DO NOTHING;
    INSERT INTO feedback_files(feedback_id,file_id,ordinal)
    SELECT feedback_id,attachment,1 FROM feedback_messages WHERE author_id=student
        AND body='В каталоге полезно показывать дату ближайшего тура отдельно от даты регистрации.'
    ON CONFLICT DO NOTHING;
    UPDATE student_projects SET cover_file_id=cover WHERE owner_id=student
        AND title='Трекер учебных задач' AND cover_file_id IS NULL;
END $$;
COMMIT;
