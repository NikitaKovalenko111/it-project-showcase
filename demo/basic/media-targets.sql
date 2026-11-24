SET search_path=showcase,public;
WITH initial_cases(title,filename) AS (VALUES
    ('Мониторинг телеметрии компрессорной станции','industrial.jpg'),
    ('Планирование маршрутов выездных бригад','routing.jpg'),
    ('Хакатон «Умный мониторинг сети»','telecom.jpg'),
    ('Поиск по базе нормативных документов','documents.jpg'),
    ('Олимпиада «Алгоритмы и данные»','olympiad.jpg'),
    ('Витрина метрик редакции','editorial.jpg'),
    ('Проверка качества справочных данных','data-quality.jpg'),
    ('Сверка показаний приборов учёта','meter.jpg'),
    ('Анализ обращений абонентов','support.jpg')
), new_cases(n,filename) AS (VALUES
    (1,'support.jpg'),(2,'industrial.jpg'),(3,'data-quality.jpg'),(4,'integration.jpg'),(5,'documents.jpg')
), new_projects(n,filename) AS (VALUES
    (1,'meter.jpg'),(2,'routing.jpg'),(3,'olympiad.jpg'),(4,'network-analysis.jpg'),
    (5,'telecom.jpg'),(6,'gis.jpg'),(7,'coding.jpg'),(8,'editorial.jpg'),
    (9,'data-quality.jpg'),(10,'documents.jpg'),(11,'coding.jpg'),(12,'telecom.jpg'),
    (13,'meter.jpg'),(14,'integration.jpg'),(15,'gis.jpg'),(16,'gis.jpg')
), company_logos(username,filename) AS (VALUES
    ('demo.gazprom','gazprom.png'),('demo.inoseti','inoseti.png'),('demo.ufanet','ufanet.png'),
    ('demo.action','action.png'),('demo.ibs','ibs.png')
), targets(kind,id,owner,filename) AS (
    SELECT 'case',c.case_id,c.created_by,m.filename FROM cases c JOIN initial_cases m ON m.title=c.title
    WHERE c.cover_file_id IS NULL
    UNION ALL
    SELECT 'case',c.case_id,c.created_by,m.filename FROM cases c
    JOIN new_cases m ON c.case_id=md5('showcase-demo-case:' || m.n)::uuid
    WHERE c.cover_file_id IS NULL
    UNION ALL
    SELECT 'project',p.project_id,p.owner_id,m.filename FROM student_projects p
    JOIN new_projects m ON p.project_id=md5('showcase-demo-project:' || m.n)::uuid
    WHERE p.cover_file_id IS NULL
    UNION ALL
    SELECT 'company',c.company_id,u.user_id,m.filename
    FROM company_logos m JOIN users u USING(username) JOIN company_members cm USING(user_id)
    JOIN companies c USING(company_id) WHERE c.logo_file_id IS NULL AND cm.status='active'
)
SELECT COALESCE(json_agg(json_build_object('kind',t.kind,'id',t.id,'owner',u.username,'filename',t.filename)), '[]'::json)
FROM targets t JOIN users u ON u.user_id=t.owner
WHERE current_database()='showcase_demo' AND current_user='showcase_demo' AND u.username LIKE 'demo.%';
