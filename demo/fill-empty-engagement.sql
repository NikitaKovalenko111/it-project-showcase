-- The importer creates these temporary tables from its stable fixture IDs.
-- Fill missing demo activity while preserving existing records and decisions.
CREATE TEMP TABLE demo_public_cases AS
SELECT c.*, CASE WHEN c.event_format='case' THEN 'application' ELSE 'registration' END AS demo_entry
FROM cases c JOIN imported_case_ids i USING(case_id)
WHERE c.visibility='public' AND c.status IN ('published','in_progress','completed');

INSERT INTO case_views(case_id,user_id,created_at)
SELECT c.case_id, reader.user_id, c.created_at
FROM demo_public_cases c
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s ORDER BY md5(c.case_id::text || s.user_id::text) LIMIT 3
) reader
WHERE NOT EXISTS (SELECT 1 FROM case_views v WHERE v.case_id=c.case_id)
ON CONFLICT DO NOTHING;

INSERT INTO applications(application_id,case_id,case_revision_id,submitted_by,student_id,status,entry_kind,submitted_at,cover_letter)
SELECT md5('demo:initial-application:' || c.case_id)::uuid, c.case_id, r.case_revision_id, candidate.user_id, candidate.user_id,
       CASE WHEN c.demo_entry='registration' OR c.status='completed' THEN 'accepted' ELSE 'submitted' END,
       c.demo_entry, c.created_at, 'Учебный отклик: готов показать пример проверки из портфолио и объяснить свой вклад.'
FROM demo_public_cases c
JOIN case_revisions r ON r.case_id=c.case_id AND r.version_no=c.terms_version
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s
    WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.case_id=c.case_id AND a.student_id=s.user_id)
    ORDER BY md5(c.case_id::text || s.user_id::text) LIMIT 1
) candidate
WHERE NOT c.nda_required AND c.participation_mode<>'team'
  AND NOT EXISTS (
    SELECT 1 FROM applications a WHERE a.case_id=c.case_id AND a.entry_kind=c.demo_entry
      AND (CASE WHEN c.demo_entry='registration' THEN a.status='accepted' ELSE a.status NOT IN ('rejected','withdrawn') END)
  )
ON CONFLICT DO NOTHING;

INSERT INTO application_consents(application_id,student_id,case_revision_id,accepted_at)
SELECT a.application_id,a.student_id,a.case_revision_id,a.submitted_at
FROM applications a JOIN demo_public_cases c USING(case_id)
WHERE a.application_id=md5('demo:initial-application:' || c.case_id)::uuid AND a.status='accepted'
ON CONFLICT DO NOTHING;

INSERT INTO comments(comment_id,resource_type,resource_id,author_id,body,created_at)
SELECT md5('demo:first-question:' || c.case_id)::uuid,'case',c.case_id,candidate.user_id,
       CASE WHEN c.status='completed' THEN 'Какой контрольный сценарий лучше воспроизвести при разборе результатов?'
            ELSE 'Можно принести на первый разбор один контрольный пример и список вопросов к данным?' END,
       c.created_at
FROM demo_public_cases c
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s ORDER BY md5(c.case_id::text || s.user_id::text) LIMIT 1
) candidate
WHERE NOT EXISTS (SELECT 1 FROM comments q WHERE q.resource_type='case' AND q.resource_id=c.case_id AND q.parent_comment_id IS NULL AND q.status='active')
ON CONFLICT DO NOTHING;

INSERT INTO comments(comment_id,resource_type,resource_id,parent_comment_id,author_id,body,created_at)
SELECT md5('demo:first-answer:' || c.case_id)::uuid,'case',c.case_id,q.comment_id,c.created_by,
       CASE WHEN c.status='completed' THEN 'Начните с основного сценария в описании кейса. Сравните ожидаемый результат с тем, что получилось на учебных данных.'
            ELSE 'Да. Подпишите ожидаемый результат и отметьте один граничный случай, который хотите обсудить с наставником.' END,
       q.created_at
FROM demo_public_cases c JOIN comments q ON q.comment_id=md5('demo:first-question:' || c.case_id)::uuid
WHERE q.status='active' AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_comment_id=q.comment_id AND r.status='active')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE demo_public_projects AS
SELECT p.* FROM student_projects p JOIN imported_project_ids i USING(project_id)
WHERE p.visibility='public' AND p.status='published';

INSERT INTO student_project_likes(project_id,user_id,created_at)
SELECT p.project_id,reader.user_id,p.created_at
FROM demo_public_projects p
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s WHERE s.user_id<>p.owner_id
    ORDER BY md5(s.user_id::text || p.project_id::text) LIMIT 2
) reader
WHERE NOT EXISTS (SELECT 1 FROM student_project_likes l WHERE l.project_id=p.project_id)
ON CONFLICT DO NOTHING;

INSERT INTO comments(comment_id,resource_type,resource_id,author_id,body,created_at)
SELECT md5('demo:portfolio-question:' || p.project_id)::uuid,'student_project',p.project_id,reader.user_id,
       'Какой пример из проекта стоит повторить, чтобы проверить основной сценарий?', p.created_at
FROM demo_public_projects p
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s WHERE s.user_id<>p.owner_id
    ORDER BY md5(s.user_id::text || p.project_id::text) LIMIT 1
) reader
WHERE NOT EXISTS (SELECT 1 FROM comments q WHERE q.resource_type='student_project' AND q.resource_id=p.project_id AND q.status='active')
ON CONFLICT DO NOTHING;

INSERT INTO comments(comment_id,resource_type,resource_id,parent_comment_id,author_id,body,created_at)
SELECT md5('demo:portfolio-answer:' || p.project_id)::uuid,'student_project',p.project_id,q.comment_id,p.owner_id,
       'Начните с основного сценария на одном рабочем примере. Для сравнения попробуйте повторить проверку с неполными входными данными.', q.created_at
FROM demo_public_projects p JOIN comments q ON q.comment_id=md5('demo:portfolio-question:' || p.project_id)::uuid
WHERE q.status='active' AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_comment_id=q.comment_id AND r.status='active')
ON CONFLICT DO NOTHING;

INSERT INTO case_favorites(user_id,case_id,created_at)
SELECT u.user_id,c.case_id,c.created_at FROM imported_student_ids u
CROSS JOIN LATERAL (
    SELECT p.case_id,p.created_at FROM demo_public_cases p WHERE p.status='published'
    ORDER BY md5(p.case_id::text || u.user_id::text) LIMIT 2
) c WHERE NOT EXISTS (SELECT 1 FROM case_favorites f WHERE f.user_id=u.user_id)
ON CONFLICT DO NOTHING;

INSERT INTO student_project_favorites(user_id,project_id,created_at)
SELECT u.user_id,p.project_id,p.created_at FROM imported_student_ids u
CROSS JOIN LATERAL (
    SELECT p.project_id,p.created_at FROM demo_public_projects p WHERE p.owner_id<>u.user_id
    ORDER BY md5(p.project_id::text || u.user_id::text) LIMIT 2
) p WHERE NOT EXISTS (SELECT 1 FROM student_project_favorites f WHERE f.user_id=u.user_id)
ON CONFLICT DO NOTHING;

INSERT INTO internship_applications(application_id,program_id,student_id,cover_letter,status,created_at)
SELECT md5('demo:first-program-application:' || p.program_id)::uuid,p.program_id,reader.user_id,
       'Хочу обсудить задачу программы и показать один выполненный учебный проект.', 'submitted',p.created_at
FROM internship_programs p JOIN imported_program_ids i USING(program_id)
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s ORDER BY md5(s.user_id::text || p.program_id::text) LIMIT 1
) reader
WHERE p.status='published' AND NOT EXISTS (SELECT 1 FROM internship_applications a WHERE a.program_id=p.program_id)
ON CONFLICT DO NOTHING;
