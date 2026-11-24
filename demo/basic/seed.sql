\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF current_database() <> 'showcase_demo' OR current_user <> 'showcase_demo' THEN
        RAISE EXCEPTION 'Use the isolated showcase_demo database and role';
    END IF;
END $$;
SET LOCAL search_path = showcase,public;
SELECT pg_advisory_xact_lock(hashtext('showcase-demo-seed-v1'));
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
DECLARE
    r record;
    person uuid;
    person2 uuid;
    moderator uuid;
    curator uuid;
    owner uuid;
    organization uuid;
    listing uuid;
    revision uuid;
    application uuid;
    run uuid;
    stage uuid;
    submission uuid;
    grade uuid;
    team uuid;
    project uuid;
    note uuid;
    program uuid;
    password_hash text;
    deadline timestamptz := date_trunc('day', now()) + interval '21 days';
    finish timestamptz := date_trunc('day', now()) + interval '40 days';
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE username='demo.admin') THEN
        RAISE NOTICE 'Demo fixtures already exist';
        RETURN;
    END IF;

    password_hash := public.crypt('DemoShowcase2026!', public.gen_salt('bf', 10));
    FOR r IN SELECT * FROM (VALUES
        ('admin','admin'),('curator','university_staff'),('gazprom','company_representative'),
        ('inoseti','company_representative'),('ufanet','company_representative'),
        ('action','company_representative'),('ibs','company_representative')
    ) AS accounts(login, role_code)
    LOOP
        INSERT INTO users(username,email,password_hash)
        VALUES ('demo.'||r.login, r.login||'@showcase.example.test', password_hash)
        RETURNING user_id INTO person;
        INSERT INTO user_roles(user_id,role_id) SELECT person,role_id FROM roles WHERE code=r.role_code;
    END LOOP;
    SELECT user_id INTO moderator FROM users WHERE username='demo.admin';
    SELECT user_id INTO curator FROM users WHERE username='demo.curator';
    PERFORM set_config('showcase.audit_actor',moderator::text,true);
    PERFORM set_config('showcase.audit_request','demo-seed',true);

    FOR r IN SELECT * FROM (VALUES
        (1,'Алина','Гарифуллина','ПРО-203Б',2,'Программная инженерия','Пишу API на Go и разбираюсь в мониторинге.'),
        (2,'Илья','Сафин','ПИ-304Б',3,'Прикладная информатика','Проектирую интерфейсы и собираю аналитические панели.'),
        (3,'Дарья','Кузнецова','ПМИ-302Б',3,'Прикладная математика и информатика','Решаю задачи на графы и оптимизацию.'),
        (4,'Марат','Ахметов','МО-201Б',2,'Математическое обеспечение и администрирование информационных систем','Настраиваю Linux и автоматизирую развёртывание.'),
        (5,'Софья','Никитина','КБ-402Б',4,'Компьютерная безопасность','Изучаю анализ журналов и безопасную разработку.'),
        (6,'Тимур','Валеев','ИБ-103Б',1,'Информационная безопасность','Изучаю сетевые протоколы и Python.'),
        (7,'Анна','Полякова','ПРО-302Б',3,'Программная инженерия','Пишу тесты, проектирую базы данных.'),
        (8,'Руслан','Каримов','ПИ-202Б',2,'Прикладная информатика','Собираю ETL и автоматизирую отчёты.'),
        (9,'Вера','Соколова','ПМИ-403Б',4,'Прикладная математика и информатика','Изучаю прикладную статистику и проверку качества данных.'),
        (10,'Денис','Морозов','МО-102Б',1,'Математическое обеспечение и администрирование информационных систем','Пишу небольшие инструменты для обработки файлов.'),
        (11,'Камилла','Хасанова','КБ-303Б',3,'Компьютерная безопасность','Разбираюсь в контроле доступа и журналировании.'),
        (12,'Егор','Орлов','ИБ-204Б',2,'Информационная безопасность','Изучаю визуализацию сетевого трафика.')
    ) AS people(n, first_name, last_name, group_name, course, direction, bio)
    LOOP
        INSERT INTO users(username,email,password_hash,group_name)
        VALUES ('demo.student'||r.n,'showcase.demo.student'||r.n||'@stud.uust.ru',password_hash,r.group_name)
        RETURNING user_id INTO person;
        INSERT INTO user_roles(user_id,role_id) SELECT person,role_id FROM roles WHERE code='student';
        INSERT INTO students(user_id,last_name,first_name,institute_name,study_direction,program_name,course,group_name,bio,
            professional_interests,competencies,technologies,links)
        VALUES (person,r.last_name,r.first_name,'Институт информатики, математики и робототехники',r.direction,r.direction,r.course,r.group_name,r.bio,
            '["Командная разработка","Анализ данных"]','["Работа с Git"]',
            CASE WHEN r.n%2=0 THEN '["Python","PostgreSQL"]'::jsonb ELSE '["Go","Git"]'::jsonb END,
            jsonb_build_array(jsonb_build_object('kind','portfolio','url','https://portfolio.example.test/student-'||r.n)));
        INSERT INTO user_consents(user_id,consent_type,version) VALUES (person,'personal_data','1.0');
        INSERT INTO directions(name) VALUES (r.direction) ON CONFLICT(name) DO NOTHING;
        IF r.n<=4 THEN
            INSERT INTO student_curators(student_id,curator_id,assigned_by) VALUES (person,curator,moderator);
        END IF;
    END LOOP;

    INSERT INTO users(username,email,password_hash) VALUES ('demo.pending','pending@showcase.example.test',password_hash)
    RETURNING user_id INTO person;
    INSERT INTO role_requests(user_id,role_code) VALUES (person,'company_representative');
    INSERT INTO technologies(name) SELECT unnest(ARRAY['Go','Python','TypeScript','React','PostgreSQL','Redis',
        'Docker','Linux','Git','FastAPI','Grafana','Prometheus','MinIO','S3','SQL','REST','pytest','Nginx'])
    ON CONFLICT(name) DO NOTHING;

    FOR r IN SELECT * FROM (VALUES
        ('gazprom','Газпром','Энергетика','Учебные задачи по телеметрии и автоматизации контроля показаний.'),
        ('inoseti','Иносети','ИТ и интеграция','Учебные задачи по планированию полевых работ и интеграции внутренних сервисов.'),
        ('ufanet','Уфанет','Телекоммуникации','Учебные сценарии по мониторингу сети и анализу событий поддержки.'),
        ('action','Актион','Информационные сервисы','Учебные сценарии поиска по документам и аналитики публикаций.'),
        ('ibs','IBS','ИТ-консалтинг','Учебные задачи по обработке данных, качеству справочников и алгоритмам.')
    ) AS companies_seed(login, name, industry, description)
    LOOP
        SELECT user_id INTO owner FROM users WHERE username='demo.'||r.login;
        INSERT INTO companies(full_name,short_name,industry,description,status)
        VALUES (r.name,r.name,r.industry,r.description||' Демонстрационная карточка.','approved') RETURNING company_id INTO organization;
        INSERT INTO company_members(company_id,user_id,position,permissions)
        VALUES (organization,owner,'Руководитель учебного проекта','["manage_company"]');
    END LOOP;

    SELECT user_id INTO person FROM users WHERE username='demo.student1';
    SELECT user_id INTO person2 FROM users WHERE username='demo.student2';
    INSERT INTO teams(name,leader_id,description,visibility,looking_for_members)
    VALUES ('Уфимский стек',person,'Команда по разработке и анализу данных. Ищем тестировщика.','open',true) RETURNING team_id INTO team;
    INSERT INTO team_members(team_id,student_id) VALUES (team,person),(team,person2);
    INSERT INTO team_invitations(team_id,invited_by,student_id)
    SELECT team,person,user_id FROM users WHERE username='demo.student3';
    INSERT INTO team_join_applications(team_id,student_id,cover_letter)
    SELECT team,user_id,'Могу помочь с тестированием и мониторингом.' FROM users WHERE username='demo.student4';
    INSERT INTO student_team_search_profiles(student_id,headline,description)
    SELECT user_id,'Ищу команду на хакатон','Могу подготовить тестовые данные и проверить API.' FROM users WHERE username='demo.student5';

    FOR r IN SELECT * FROM (VALUES
        (1,'gazprom','Мониторинг телеметрии компрессорной станции','Собрать панель по синтетическим показаниям датчиков и обнаруживать пропуски и выход за пороги.','case','published',1),
        (2,'inoseti','Планирование маршрутов выездных бригад','Распределить заявки между бригадами с учётом приоритетов, времени обслуживания и транспортных ограничений.','case','in_progress',2),
        (3,'ufanet','Хакатон «Умный мониторинг сети»','Построить карту сетевых инцидентов по синтетическим сигналам и сгруппировать связанные срабатывания.','hackathon','published',2),
        (4,'action','Поиск по базе нормативных документов','Реализовать поиск по учебному корпусу документов с подсветкой совпадений и фильтрацией по дате.','case','moderation',1),
        (5,'ibs','Олимпиада «Алгоритмы и данные»','Решить задачи на графы, интервалы и обработку агрегатов за два тура.','olympiad','published',1),
        (6,'action','Витрина метрик редакции','Собрать ETL для учебной статистики публикаций и построить воспроизводимый отчёт по метрикам.','case','completed',1),
        (7,'ibs','Проверка качества справочных данных','Найти дубликаты и пропуски во входном CSV и сформировать отчёт о качестве данных.','case','draft',1),
        (8,'gazprom','Сверка показаний приборов учёта','Сопоставить два синтетических набора показаний и подготовить реестр расхождений.','case','revision',1),
        (9,'ufanet','Анализ обращений абонентов','Выделить повторяющиеся причины обращений на наборе обезличенных учебных записей.','case','published',1)
    ) AS fixtures(n, company_login, title, summary, format, final_status, team_size)
    LOOP
        SELECT c.company_id,u.user_id INTO organization,owner FROM companies c
        JOIN company_members m USING(company_id) JOIN users u USING(user_id) WHERE u.username='demo.'||r.company_login;
        INSERT INTO cases(company_id,created_by,title,summary,full_brief,type,event_format,work_format,participation_mode,admission_mode,
            capacity,team_size_min,team_size_max,application_deadline,due_at,result_requirements,ip_terms)
        VALUES (organization,owner,r.title,r.summary,r.summary||' Используйте синтетические данные. Объясните архитектуру и добавьте инструкцию запуска.',
            CASE WHEN r.format='case' THEN 'educational' ELSE 'contest' END,r.format,'remote',
            CASE WHEN r.team_size=1 THEN 'individual' ELSE 'team' END,CASE WHEN r.format='case' THEN 'selection' ELSE 'open' END,
            8,r.team_size,r.team_size,deadline,finish,'Репозиторий с README, тестами и результатами демонстрации.','Учебное использование материалов.')
        RETURNING case_id INTO listing;

        INSERT INTO case_revisions(case_id,version_no,brief_snapshot,ip_terms_snapshot,created_by)
        VALUES (listing,1,jsonb_build_object('title',r.title,'summary',r.summary,'full_brief',r.summary),'Учебное использование материалов.',owner)
        RETURNING case_revision_id INTO revision;
        INSERT INTO case_directions(case_id,direction_id)
        SELECT listing,direction_id FROM directions WHERE name='Программная инженерия';
        INSERT INTO case_technologies(case_id,technology_id)
        SELECT listing,technology_id FROM technologies WHERE name IN ('PostgreSQL',CASE WHEN r.n%2=0 THEN 'Python' ELSE 'Go' END);
        INSERT INTO evaluation_criteria(case_id,name,max_score,ordinal) VALUES
            (listing,'Корректность решения',60,1),(listing,'Воспроизводимость и документация',40,2);
        INSERT INTO case_stages(case_id,ordinal,title,expected_result,due_at) VALUES
            (listing,1,'Прототип','Базовый сценарий и проверка на учебных данных.',deadline + interval '5 days'),
            (listing,2,'Демонстрация','Результаты проверки, README и запись демонстрации.',finish);
        IF r.format IN ('hackathon','olympiad') THEN
            INSERT INTO event_plans(case_id,plan) VALUES (listing,jsonb_build_object(
                'subject',r.title,'time_zone','Asia/Yekaterinburg','platform_name','Учебная площадка',
                'platform_url','https://events.example.test','agenda','Вводная встреча, работа участников и разбор результатов.',
                'rounds', CASE WHEN r.format='olympiad' THEN (
                    SELECT jsonb_agg(jsonb_build_object('round_id',gen_random_uuid(),'title',x.title,
                        'opens_at',x.opens_at,'due_at',x.due_at,'tasks',jsonb_build_array(
                            jsonb_build_object('task_id',gen_random_uuid(),'title',x.task,'statement',x.statement,'max_score',50,'file_ids','[]'::jsonb))))
                    FROM (VALUES ('Отборочный тур',now()-interval '1 hour',deadline,'Маршрут по графу','Найдите кратчайший маршрут между двумя вершинами.'),
                        ('Финальный тур',deadline+interval '1 day',finish,'Нагрузка по интервалам','Найдите максимальное количество одновременно активных заявок.'))
                    AS x(title,opens_at,due_at,task,statement)
                ) ELSE '[]'::jsonb END));
        END IF;
        IF r.final_status NOT IN ('draft','moderation') THEN
            INSERT INTO case_moderation_events(case_id,case_revision_id,moderator_id,previous_status,new_status,decision,comment)
            VALUES (listing,revision,moderator,'moderation',CASE WHEN r.final_status='revision' THEN 'revision' ELSE 'published' END,
                CASE WHEN r.final_status='revision' THEN 'request_revision' ELSE 'approve' END,
                CASE WHEN r.final_status='revision' THEN 'Уточните форматы входных данных.' ELSE 'Учебная публикация проверена.' END);
        END IF;
        UPDATE cases SET status=r.final_status WHERE case_id=listing;

        IF r.n IN (1,2,5,6,9) THEN
            INSERT INTO applications(case_id,case_revision_id,submitted_by,student_id,team_id,status,entry_kind,cover_letter)
            VALUES (listing,revision,person,CASE WHEN r.n<>2 THEN person END,CASE WHEN r.n=2 THEN team END,
                CASE WHEN r.n=1 THEN 'submitted' WHEN r.n=9 THEN 'info_requested' ELSE 'accepted' END,
                CASE WHEN r.format='olympiad' THEN 'registration' ELSE 'application' END,'Готов подготовить прототип и описать результаты.')
            RETURNING application_id INTO application;
            IF r.n IN (2,5,6) THEN
                INSERT INTO application_consents(application_id,student_id,case_revision_id)
                VALUES (application,person,revision);
                IF r.n=2 THEN
                    INSERT INTO application_consents(application_id,student_id,case_revision_id)
                    VALUES (application,person2,revision);
                END IF;
                INSERT INTO executions(case_id,application_id,team_id,status,started_at,due_at,ended_at)
                VALUES (listing,application,CASE WHEN r.n=2 THEN team END,CASE WHEN r.n=6 THEN 'done' ELSE 'in_progress' END,
                    now()-interval '5 days',finish,CASE WHEN r.n=6 THEN now()-interval '1 day' END) RETURNING execution_id INTO run;
                INSERT INTO execution_members(execution_id,student_id) VALUES (run,person);
                IF r.n=2 THEN
                    INSERT INTO execution_members(execution_id,student_id) VALUES (run,person2);
                END IF;
                INSERT INTO execution_stages(execution_id,stage_id,status,completed_at)
                SELECT run,stage_id,CASE WHEN r.n=6 THEN 'accepted' WHEN ordinal=1 THEN 'submitted' ELSE 'pending' END,
                    CASE WHEN r.n=6 THEN now()-interval '1 day' END FROM case_stages WHERE case_id=listing;
                IF r.n=2 THEN
                    SELECT stage_id INTO stage FROM case_stages WHERE case_id=listing AND ordinal=1;
                    INSERT INTO submissions(execution_id,stage_id,version_no,kind,title,description,submitted_by)
                    VALUES (run,stage,1,'stage','Прототип маршрутизации','Сравнили базовый и жадный алгоритмы на 40 заявках.',person);
                    INSERT INTO execution_comments(execution_id,stage_id,author_id,body)
                    VALUES (run,stage,owner,'На проверке. Добавьте пример с двумя срочными заявками.');
                ELSIF r.n=6 THEN
                    INSERT INTO submissions(execution_id,version_no,kind,title,description,submitted_by,status)
                    VALUES (run,1,'final','Итоговый отчёт','ETL и витрина метрик с инструкцией запуска.',person,'accepted') RETURNING submission_id INTO submission;
                    INSERT INTO evaluations(submission_id,evaluator_id,total_score,max_score,feedback,published_at)
                    VALUES (submission,owner,92,100,'Сценарий воспроизводится, договорились добавить проверку пустого входа.',now())
                    RETURNING evaluation_id INTO grade;
                    INSERT INTO criterion_scores(evaluation_id,criterion_id,score)
                    SELECT grade,criterion_id,CASE WHEN ordinal=1 THEN 56 ELSE 36 END FROM evaluation_criteria WHERE case_id=listing;
                    INSERT INTO case_placements(case_id,execution_id,place_no,assigned_by) VALUES (listing,run,1,owner);
                    INSERT INTO awards(execution_id,title,place_no,awarded_by) VALUES (run,'Лучший учебный отчёт',1,owner);
                ELSIF r.n=5 THEN
                    INSERT INTO notifications(user_id,type,title,body,resource_type,resource_id)
                    VALUES (person,'demo_event','Тур открыт','Доступно условие отборочного тура.','case',listing);
                END IF;
            END IF;
        END IF;
        IF r.n=1 THEN
            INSERT INTO case_favorites(user_id,case_id) VALUES (person,listing);
            INSERT INTO case_views(user_id,case_id) VALUES (person,listing),(person2,listing);
            INSERT INTO comments(resource_type,resource_id,author_id,body)
            VALUES ('case',listing,person,'Можно ли использовать Grafana для визуализации?') RETURNING comment_id INTO note;
            INSERT INTO comments(resource_type,resource_id,parent_comment_id,author_id,body)
            VALUES ('case',listing,note,owner,'Да, опишите настройку источника данных в README.');
            INSERT INTO comment_likes(comment_id,user_id) VALUES (note,person2);
            INSERT INTO company_invitations(company_id,student_id,kind,message,sent_by)
            VALUES (organization,person2,'interview','Приглашаем обсудить учебный проект и ваш опыт мониторинга.',owner);
        END IF;
    END LOOP;

    FOR r IN SELECT * FROM (VALUES
        ('ufanet','Стажировка по эксплуатации сервисов','internship','published','Настройка дашбордов и разбор инцидентов на учебных данных.'),
        ('ibs','Практика по контролю качества данных','practice','published','Проверка CSV, поиск дубликатов и подготовка протокола качества.'),
        ('action','Стажировка в поисковой команде','internship','moderation','Настройка индекса и проверка качества выдачи на учебных документах.'),
        ('inoseti','Практика по интеграции систем','practice','draft','Сопоставление форматов входных заявок и проверка импорта.'),
        ('gazprom','Практика по аналитике телеметрии','practice','revision','Сравнение наборов показаний и подготовка витрины аномалий.')
    ) AS programs(login,title,kind,status,summary)
    LOOP
        SELECT c.company_id,u.user_id INTO organization,owner FROM companies c
        JOIN company_members m USING(company_id) JOIN users u USING(user_id) WHERE u.username='demo.'||r.login;
        INSERT INTO internship_programs(company_id,created_by,title,kind,status,summary,content_markdown,capacity,application_deadline,published_at)
        VALUES (organization,owner,r.title,r.kind,r.status,r.summary,r.summary||' Формат: учебная программа, 4 недели.',4,deadline,
            CASE WHEN r.status='published' THEN now() END) RETURNING program_id INTO program;
        IF r.status='published' THEN
            INSERT INTO internship_applications(program_id,student_id,cover_letter)
            VALUES (program,person,'Хочу применить навыки работы с данными на практике.');
        END IF;
    END LOOP;

    INSERT INTO student_projects(owner_id,title,category,short_description,full_description,status,published_at,tags)
    VALUES (person,'Трекер учебных задач','pet_project','Планирование задач небольшой команды.',
        'Веб-приложение с дедлайнами, доской и выгрузкой отчётов.','published',now(),'["Go","Веб-разработка"]')
    RETURNING project_id INTO project;
    INSERT INTO student_project_likes(project_id,user_id) VALUES (project,person2);
    INSERT INTO student_project_favorites(project_id,user_id) VALUES (project,person2);
    INSERT INTO student_projects(owner_id,title,category,short_description,full_description,status,visibility)
    VALUES (person2,'Карта учебных аудиторий','coursework','Поиск аудиторий и построение маршрута.',
        'Прототип для демонстрации навигации между корпусами.','moderation','public'),
        (person,'Анализ сетевых событий','research','Разбор синтетических сетевых журналов.',
        'Набор запросов для поиска повторяющихся сетевых событий.','draft','private');
    INSERT INTO feedback_messages(author_id,body) VALUES (person,'В каталоге полезно показывать дату ближайшего тура отдельно от даты регистрации.');
    INSERT INTO reports(resource_type,resource_id,reporter_id,reason,details)
    VALUES ('student_project',project,person2,'other','Учебная жалоба для проверки очереди модератора.');
END $$;
COMMIT;
