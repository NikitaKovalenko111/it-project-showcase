-- Additional scenarios for the full demo import. Uses the staging tables created
-- by import.mjs and runs inside its guarded transaction.

UPDATE cases c SET capacity = greatest(10, (
    SELECT count(*) FROM applications a WHERE a.case_id=c.case_id AND a.status='accepted'
))
FROM imported_case_ids i WHERE c.case_id=i.case_id AND c.capacity IS NULL;

CREATE TEMP VIEW demo_scenario_admin AS SELECT user_id FROM users WHERE username='demo.admin';
CREATE TEMP VIEW demo_scenario_students AS
SELECT s.user_id, row_number() OVER (ORDER BY u.username) AS n
FROM imported_student_ids s JOIN users u USING(user_id);

INSERT INTO user_consents(consent_id,user_id,consent_type,version)
SELECT md5('coverage:consent:'||u.user_id)::uuid,u.user_id,'personal_data','1.0'
FROM imported_student_ids u
WHERE NOT EXISTS (SELECT 1 FROM user_consents c WHERE c.user_id=u.user_id AND c.consent_type='personal_data')
ON CONFLICT DO NOTHING;

INSERT INTO users(user_id,username,email,password_hash,status)
SELECT md5('coverage:account:'||x.login)::uuid,x.login,x.login||'@showcase.example.test',p.hash,x.status
FROM import_password p CROSS JOIN (VALUES
    ('demo.coverage-pending','active'),('demo.coverage-rejected','active'),('demo.coverage-blocked','blocked')
) AS x(login,status) ON CONFLICT DO NOTHING;

INSERT INTO role_requests(user_id,role_code,status,reviewed_by,reviewed_at)
SELECT u.user_id,x.role_code,x.status,CASE WHEN x.status='rejected' THEN a.user_id END,
    CASE WHEN x.status='rejected' THEN now() END
FROM (VALUES ('demo.coverage-pending','company_representative','pending'),
    ('demo.coverage-rejected','university_staff','rejected')) x(login,role_code,status)
JOIN users u ON u.username=x.login CROSS JOIN demo_scenario_admin a
WHERE u.user_id=md5('coverage:account:'||x.login)::uuid ON CONFLICT DO NOTHING;

INSERT INTO user_roles(user_id,role_id)
SELECT u.user_id,r.role_id FROM users u CROSS JOIN roles r
WHERE u.user_id=md5('coverage:account:demo.coverage-blocked')::uuid AND r.code='student'
ON CONFLICT DO NOTHING;

INSERT INTO companies(company_id,full_name,short_name,industry,description,status,website,contacts)
SELECT md5('coverage:company:'||x.status)::uuid,x.title,x.title,'Образование','Учебная карточка для проверки модерации компании.',
    x.status,'https://lab.example.test','contact@lab.example.test'
FROM (VALUES ('pending','Учебная лаборатория · на проверке'),('rejected','Учебная лаборатория · отклонена')) x(status,title)
ON CONFLICT DO NOTHING;

INSERT INTO internship_programs(program_id,company_id,created_by,title,kind,summary,content_markdown,capacity,application_deadline,status)
SELECT md5('coverage:program:'||x.status)::uuid,p.company_id,p.created_by,x.title,x.kind,
    'Учебная программа для проверки статуса публикации.','Разобрать требования, подготовить прототип и обсудить результаты.',
    4,now()+interval '21 days',x.status
FROM (SELECT p.* FROM internship_programs p JOIN imported_program_ids i USING(program_id)
      WHERE p.status='published' ORDER BY p.program_id LIMIT 1) p
CROSS JOIN (VALUES ('draft','Черновик учебной стажировки','internship'),
    ('moderation','Учебная практика на модерации','practice'),
    ('revision','Учебная стажировка на доработке','internship'),
    ('hidden','Скрытая учебная практика','practice'),
    ('closed','Завершённый набор на учебную практику','practice')) x(status,title,kind)
ON CONFLICT DO NOTHING;

INSERT INTO student_projects(project_id,owner_id,title,category,short_description,full_description,visibility,status,moderation_comment,github_url,product_url)
SELECT md5('coverage:student-project:'||x.status)::uuid,s.user_id,x.title,'coursework',
    'Учебный проект для проверки состояния публикации.','Собрать прототип и описать проверку результата.',
    CASE WHEN x.status='draft' THEN 'private' ELSE 'public' END,x.status,x.comment,
    'https://code.example.test/demo/project','https://preview.example.test/demo/project'
FROM (VALUES ('draft','Личный черновик',NULL),
    ('moderation','Учебный проект на модерации',NULL),
    ('revision','Учебный проект на доработке','Добавьте описание проверки.'),
    ('hidden','Скрытый учебный проект','Карточка скрыта при проверке.')) x(status,title,comment)
JOIN demo_scenario_students s ON s.n=1 ON CONFLICT DO NOTHING;

INSERT INTO student_project_moderation_events(moderation_event_id,project_id,moderator_id,previous_status,new_status,comment)
SELECT md5('coverage:student-project-review:'||p.status)::uuid,p.project_id,a.user_id,
    CASE WHEN p.status='hidden' THEN 'published' ELSE 'moderation' END,p.status,p.moderation_comment
FROM student_projects p CROSS JOIN demo_scenario_admin a
WHERE p.status IN ('revision','hidden') AND p.project_id=md5('coverage:student-project:'||p.status)::uuid
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE demo_team_targets AS
SELECT t.team_id,t.leader_id,s.user_id AS candidate, row_number() OVER (ORDER BY t.team_id) AS n
FROM (SELECT t.* FROM teams t JOIN team_members m ON m.team_id=t.team_id AND m.student_id=t.leader_id
      JOIN imported_student_ids i ON i.user_id=t.leader_id
      WHERE t.status='active' AND t.team_id IN (SELECT team_id FROM imported_team_ids) ORDER BY t.team_id LIMIT 4) t
CROSS JOIN LATERAL (
    SELECT s.user_id FROM imported_student_ids s WHERE s.user_id<>t.leader_id AND NOT EXISTS (
        SELECT 1 FROM team_members m WHERE m.team_id=t.team_id AND m.student_id=s.user_id
    ) ORDER BY md5(t.team_id::text||s.user_id::text) LIMIT 1
) s;

UPDATE teams t SET visibility='open',looking_for_members=true
FROM demo_team_targets d WHERE t.team_id=d.team_id AND d.n>=2
AND NOT EXISTS (SELECT 1 FROM team_join_applications a
                WHERE a.join_application_id=md5('coverage:team-application:'||d.team_id)::uuid);

INSERT INTO team_invitations(team_invitation_id,team_id,invited_by,student_id,status,responded_at)
SELECT md5('coverage:team-invitation:'||team_id)::uuid,team_id,leader_id,candidate,
    CASE n WHEN 1 THEN 'pending' WHEN 2 THEN 'declined' ELSE 'revoked' END,
    CASE WHEN n<>1 THEN now() END FROM demo_team_targets WHERE n<=3
ON CONFLICT DO NOTHING;

INSERT INTO team_join_applications(join_application_id,team_id,student_id,cover_letter,status,responded_at)
SELECT md5('coverage:team-application:'||team_id)::uuid,team_id,candidate,'Хочу помочь команде с тестами и документацией.',
    CASE n WHEN 2 THEN 'pending' WHEN 3 THEN 'rejected' ELSE 'withdrawn' END,
    CASE WHEN n<>2 THEN now() END FROM demo_team_targets WHERE n>=2
ON CONFLICT DO NOTHING;

INSERT INTO team_invitations(team_invitation_id,team_id,invited_by,student_id,status,responded_at)
SELECT md5('coverage:team-accepted:'||d.team_id)::uuid,d.team_id,d.leader_id,m.student_id,'accepted',now()
FROM demo_team_targets d
CROSS JOIN LATERAL (
    SELECT m.student_id FROM team_members m WHERE m.team_id=d.team_id AND m.student_id<>d.leader_id
    AND m.left_at IS NULL ORDER BY m.student_id LIMIT 1
) m WHERE d.n=1 ON CONFLICT DO NOTHING;

INSERT INTO student_team_search_profiles(student_id,headline,description)
SELECT DISTINCT candidate,'Ищу команду для учебного проекта','Готов помочь с тестированием и документацией.'
FROM demo_team_targets ON CONFLICT DO NOTHING;

INSERT INTO feedback_messages(feedback_id,author_id,body,status,moderator_id,reviewed_at)
SELECT md5('coverage:feedback:'||x.status)::uuid,s.user_id,x.body,x.status,
    CASE WHEN x.status<>'reviewing' THEN a.user_id END,CASE WHEN x.status<>'reviewing' THEN now() END
FROM (VALUES ('reviewing','Вложил пример для проверки формы обратной связи.'),
    ('reviewed','Прошу проверить подпись в карточке проекта.'),
    ('accepted','Добавьте подсказку в форму заявки.'),
    ('rejected','Проверка отклонённого обращения.')) x(status,body)
JOIN demo_scenario_students s ON s.n=1 CROSS JOIN demo_scenario_admin a
ON CONFLICT DO NOTHING;

INSERT INTO reports(report_id,reporter_id,resource_type,resource_id,reason,details,status,moderator_id,resolved_at)
SELECT md5('coverage:report:'||x.status)::uuid,s.user_id,'case',c.case_id,'other','Проверка очереди жалоб.',x.status,
    CASE WHEN x.status<>'open' THEN a.user_id END, CASE WHEN x.status IN ('resolved','rejected') THEN now() END
FROM (VALUES ('open',1),('reviewing',2),('resolved',3),('rejected',4)) x(status,n)
JOIN demo_scenario_students s ON s.n=x.n CROSS JOIN demo_scenario_admin a
CROSS JOIN (SELECT c.case_id FROM cases c JOIN imported_case_ids i USING(case_id)
            WHERE c.status='published' AND c.visibility='public' ORDER BY c.case_id LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO notifications(notification_id,user_id,type,title,body,read_at)
SELECT md5('coverage:read-notification:'||s.user_id)::uuid,s.user_id,'showcase',
    'Учебное уведомление прочитано','Запись показывает состояние прочитанного уведомления.',now()
FROM demo_scenario_students s WHERE s.n<=4 ON CONFLICT DO NOTHING;

CREATE TEMP VIEW demo_nda_targets AS
SELECT c.case_id FROM cases c JOIN imported_case_ids i USING(case_id) WHERE c.visibility='restricted'
UNION
(SELECT c.case_id FROM cases c JOIN imported_case_ids i USING(case_id)
 WHERE c.visibility='public' AND c.status='published' AND c.event_format='case'
 AND c.participation_mode='individual' ORDER BY c.case_id LIMIT 1);

INSERT INTO case_nda_versions(nda_version_id,case_id,version_no,text,created_by)
SELECT md5('coverage:nda:'||c.case_id)::uuid,c.case_id,1,
    'Учебное соглашение. Материалы доступны участнику после принятия условий и не предназначены для публикации.',
    c.created_by FROM cases c JOIN demo_nda_targets i USING(case_id)
WHERE NOT EXISTS (SELECT 1 FROM case_nda_versions v WHERE v.case_id=c.case_id AND v.is_current)
ON CONFLICT DO NOTHING;

UPDATE cases c SET nda_required=true FROM demo_nda_targets i
WHERE c.case_id=i.case_id AND NOT c.nda_required
AND EXISTS (SELECT 1 FROM case_nda_versions v WHERE v.case_id=c.case_id AND v.is_current);

INSERT INTO nda_grants(nda_grant_id,case_id,student_id,status,granted_at,nda_version_id,accepted_at)
SELECT md5('coverage:nda-grant:'||v.case_id||':'||s.user_id)::uuid,v.case_id,s.user_id,x.status,
    CASE WHEN x.status='granted' THEN now() END,v.nda_version_id,
    CASE WHEN x.status='granted' THEN now() END
FROM case_nda_versions v JOIN imported_case_ids i USING(case_id)
CROSS JOIN (VALUES (1,'granted'),(2,'pending'),(3,'rejected'),(4,'revoked')) x(n,status)
JOIN demo_scenario_students s ON s.n=x.n WHERE v.is_current
ON CONFLICT DO NOTHING;

INSERT INTO company_invitations(company_invitation_id,company_id,student_id,case_id,kind,status,message,sent_by,responded_at)
SELECT md5('coverage:nda-invitation:'||c.case_id||':'||s.user_id)::uuid,c.company_id,s.user_id,c.case_id,
    'case',CASE WHEN s.n<=2 THEN 'accepted' ELSE 'sent' END,
    'Учебное приглашение в конфиденциальный кейс.',c.created_by,CASE WHEN s.n<=2 THEN now() END
FROM cases c JOIN demo_nda_targets i USING(case_id) CROSS JOIN demo_scenario_students s
WHERE c.visibility='restricted' AND c.nda_required AND s.n<=3 ON CONFLICT DO NOTHING;

INSERT INTO applications(application_id,case_id,case_revision_id,submitted_by,student_id,status,cover_letter)
SELECT md5('coverage:nda-application:'||c.case_id)::uuid,c.case_id,r.case_revision_id,s.user_id,s.user_id,
    'accepted','Учебное участие для проверки доступа к материалам под NDA.'
FROM cases c JOIN demo_nda_targets d USING(case_id)
JOIN case_revisions r ON r.case_id=c.case_id AND r.version_no=c.terms_version
JOIN demo_scenario_students s ON s.n=1
WHERE c.visibility='public' AND c.participation_mode='individual' ON CONFLICT DO NOTHING;

INSERT INTO executions(execution_id,case_id,application_id,status,started_at,due_at)
SELECT md5('coverage:nda-execution:'||a.application_id)::uuid,a.case_id,a.application_id,'in_progress',now(),c.due_at
FROM applications a JOIN demo_nda_targets d USING(case_id) JOIN cases c USING(case_id)
JOIN demo_scenario_students s ON s.n=1 AND s.user_id=a.student_id
WHERE a.status='accepted' AND c.visibility='public' ON CONFLICT DO NOTHING;

INSERT INTO application_consents(application_id,student_id,case_revision_id,accepted_at)
SELECT a.application_id,a.student_id,a.case_revision_id,e.started_at
FROM executions e JOIN applications a USING(application_id) JOIN demo_nda_targets d ON d.case_id=e.case_id
WHERE e.execution_id=md5('coverage:nda-execution:'||a.application_id)::uuid
ON CONFLICT DO NOTHING;

INSERT INTO execution_members(execution_id,student_id,joined_at)
SELECT e.execution_id,a.student_id,e.started_at
FROM executions e JOIN applications a USING(application_id) JOIN demo_nda_targets d ON d.case_id=e.case_id
WHERE e.execution_id=md5('coverage:nda-execution:'||a.application_id)::uuid
ON CONFLICT DO NOTHING;

INSERT INTO event_plans(case_id,plan)
SELECT c.case_id,jsonb_build_object('subject',c.title,'time_zone','Asia/Yekaterinburg',
    'venue_name','Учебная аудитория','address','Уфа','platform_name','Учебная площадка',
    'platform_url','https://example.test/event','regulations','Регламент учебного мероприятия.',
    'agenda','Вводная встреча, работа над заданием, защита.','rounds',
    CASE WHEN c.event_format='olympiad' THEN (
        SELECT jsonb_agg(jsonb_build_object(
            'round_id',md5('coverage:round:'||c.case_id||':'||n)::uuid,
            'title','Тур '||n,'opens_at',now()+opening,'due_at',now()+closing,
            'rules','Отправьте текст решения и результат проверки.',
            'tasks',jsonb_build_array(jsonb_build_object(
                'task_id',md5('coverage:task:'||c.case_id||':'||n)::uuid,
                'title','Учебное задание','statement','Подготовьте решение и два примера проверки.',
                'file_ids',jsonb_build_array(),'max_score',50))) ORDER BY n)
        FROM (VALUES (1,interval '-2 days',interval '5 days'),(2,interval '6 days',interval '10 days')) r(n,opening,closing)
    ) ELSE '[]'::jsonb END)
FROM cases c JOIN imported_case_ids i USING(case_id)
WHERE c.event_format IN ('hackathon','olympiad') AND c.status NOT IN ('hidden','cancelled')
ON CONFLICT DO NOTHING;

UPDATE cases c SET due_at=greatest(c.due_at,(p.plan#>>'{rounds,1,due_at}')::timestamptz),
    application_deadline=greatest(c.application_deadline,(p.plan#>>'{rounds,0,due_at}')::timestamptz - interval '1 day')
FROM event_plans p JOIN imported_case_ids i USING(case_id)
WHERE p.case_id=c.case_id AND c.event_format='olympiad' AND c.status='published'
AND p.plan#>>'{rounds,1,round_id}'=md5('coverage:round:'||c.case_id||':2')::uuid::text
AND (c.due_at IS NULL OR c.due_at<(p.plan#>>'{rounds,1,due_at}')::timestamptz
     OR c.application_deadline IS NULL);

INSERT INTO executions(execution_id,case_id,application_id,status,started_at,due_at)
SELECT md5('coverage:olympiad-execution:'||a.application_id)::uuid,c.case_id,a.application_id,
    'in_progress',now()-interval '2 days',greatest(c.due_at,now()+interval '10 days')
FROM cases c JOIN imported_case_ids i USING(case_id) JOIN event_plans p USING(case_id)
CROSS JOIN LATERAL (
    SELECT a.application_id FROM applications a
    WHERE a.case_id=c.case_id AND a.entry_kind='registration' AND a.student_id IS NOT NULL AND a.status='accepted'
    ORDER BY a.submitted_at,a.application_id LIMIT 1
) a
WHERE c.event_format='olympiad' AND c.status IN ('published','in_progress')
ON CONFLICT DO NOTHING;

INSERT INTO application_consents(application_id,student_id,case_revision_id,accepted_at)
SELECT a.application_id,a.student_id,a.case_revision_id,e.started_at
FROM executions e JOIN applications a USING(application_id) JOIN imported_case_ids i ON i.case_id=e.case_id
WHERE e.execution_id=md5('coverage:olympiad-execution:'||a.application_id)::uuid
ON CONFLICT DO NOTHING;

INSERT INTO execution_members(execution_id,student_id,joined_at)
SELECT e.execution_id,a.student_id,e.started_at
FROM executions e JOIN applications a USING(application_id) JOIN imported_case_ids i ON i.case_id=e.case_id
WHERE e.execution_id=md5('coverage:olympiad-execution:'||a.application_id)::uuid
ON CONFLICT DO NOTHING;

INSERT INTO event_round_submissions(execution_id,round_id,submitted_by,solutions,submitted_at,scores,total_score,max_score,evaluated_by,evaluated_at)
SELECT e.execution_id,(r.round->>'round_id')::uuid,e.student_id,
    jsonb_build_array(jsonb_build_object('task_id',r.round->'tasks'->0->>'task_id','text','Решение с двумя проверочными примерами.')),
    now()-interval '1 day',
    jsonb_build_array(jsonb_build_object('task_id',r.round->'tasks'->0->>'task_id','score',42)),
    42,50,e.created_by,now()
FROM event_plans p JOIN imported_case_ids i USING(case_id)
CROSS JOIN LATERAL (
    SELECT e.execution_id,m.student_id,c.created_by FROM executions e JOIN execution_members m USING(execution_id)
    JOIN cases c ON c.case_id=e.case_id WHERE e.case_id=p.case_id ORDER BY e.execution_id,m.student_id LIMIT 1
) e
CROSS JOIN LATERAL (SELECT p.plan->'rounds'->0 AS round) r
WHERE r.round IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO case_deadline_changes(change_id,case_id,changed_by,previous_due_at,due_at,reason)
SELECT md5('coverage:deadline:'||c.case_id)::uuid,c.case_id,c.created_by,c.due_at-interval '3 days',c.due_at,
    'Учебный перенос срока для повторной защиты.'
FROM (SELECT c.* FROM cases c JOIN imported_case_ids i USING(case_id)
      WHERE c.status='in_progress' AND c.due_at IS NOT NULL ORDER BY c.case_id LIMIT 3) c
ON CONFLICT DO NOTHING;

INSERT INTO criterion_scores(evaluation_id,criterion_id,score,comment)
SELECT v.evaluation_id,criteria.criterion_id,
    greatest(0,least(criteria.max_score,v.total_score-criteria.previous_max)),
    'Учебная оценка по критерию.'
FROM evaluations v JOIN submissions s USING(submission_id) JOIN executions e USING(execution_id)
JOIN imported_case_ids i USING(case_id)
JOIN LATERAL (
    SELECT c.criterion_id,c.max_score,coalesce(sum(c.max_score) OVER (
        ORDER BY c.ordinal,c.criterion_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ),0) AS previous_max FROM evaluation_criteria c WHERE c.case_id=e.case_id
) criteria ON true
WHERE NOT EXISTS (SELECT 1 FROM criterion_scores x WHERE x.evaluation_id=v.evaluation_id)
ON CONFLICT DO NOTHING;

INSERT INTO case_placements(case_id,execution_id,place_no,assigned_by)
SELECT x.case_id,x.execution_id,x.place_no::integer,x.created_by
FROM (
    SELECT DISTINCT ON (e.case_id) e.case_id,e.execution_id,c.created_by,1 AS place_no
    FROM executions e JOIN cases c USING(case_id) JOIN imported_case_ids i USING(case_id)
    JOIN submissions s ON s.execution_id=e.execution_id AND s.kind='final'
    JOIN evaluations v USING(submission_id)
    WHERE c.status='completed' AND e.status='done' AND v.status='published'
    ORDER BY e.case_id,v.total_score DESC,e.execution_id
) x
WHERE NOT EXISTS (SELECT 1 FROM case_placements p WHERE p.case_id=x.case_id)
ON CONFLICT DO NOTHING;
