\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = showcase,public;

DO $$
DECLARE
    fixture record;
    account_id uuid;
    company_id_for_fixture uuid;
    item_id uuid;
BEGIN
    IF current_database() <> 'showcase_demo' OR current_user <> 'showcase_demo' THEN
        RAISE EXCEPTION 'Use the isolated showcase_demo database and role';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('showcase-demo-seed-v1'));

    FOR fixture IN SELECT * FROM (VALUES
        (1, 'gazprom', 'Стажировка по разработке сервисов телеметрии', 'internship', 'published', 'Разработать API приёма измерений и добавить проверки качества данных.', 8),
        (2, 'gazprom', 'Практика по цифровым двойникам', 'practice', 'published', 'Собрать учебную модель оборудования и сравнить расчёты с синтетической телеметрией.', 5),
        (3, 'inoseti', 'Стажировка Go-разработчика', 'internship', 'published', 'Реализовать импорт заявок, обработку ошибок и интеграционные тесты.', 6),
        (4, 'inoseti', 'Практика по тестированию интеграций', 'practice', 'published', 'Подготовить матрицу сценариев и проверить обмен данными между сервисами.', 4),
        (5, 'ufanet', 'Стажировка по сетевому мониторингу', 'internship', 'published', 'Настроить мониторинг учебного сегмента сети и описать порядок разбора инцидентов.', 8),
        (6, 'ufanet', 'Практика по автоматизации поддержки', 'practice', 'moderation', 'Разработать шаблоны обработки обращений и отчёт о повторяющихся инцидентах.', 4),
        (7, 'action', 'Стажировка по поиску и индексации', 'internship', 'published', 'Сравнить способы ранжирования выдачи на учебном корпусе документов.', 5),
        (8, 'action', 'Практика по аналитике публикаций', 'practice', 'published', 'Построить модель данных для статистики публикаций и собрать отчёт в SQL.', 4),
        (9, 'ibs', 'Стажировка инженера данных', 'internship', 'published', 'Собрать ETL-процесс для справочников и встроить проверки качества.', 7),
        (10, 'ibs', 'Практика по бизнес-анализу', 'practice', 'published', 'Описать требования к витрине данных и критерии приёмки.', 6),
        (11, 'ibs', 'Стажировка по автоматизации тестирования', 'internship', 'revision', 'Покрыть тестами учебный API и оформить отчёт о стабильности сценариев.', 4),
        (12, 'inoseti', 'Стажировка по выпуску сервисов', 'internship', 'draft', 'Подготовить Docker-окружение, автоматизировать сборку и задокументировать откат.', 3)
    ) AS programs(n, company_login, title, kind, status, summary, capacity)
    LOOP
        SELECT u.user_id, m.company_id INTO STRICT account_id, company_id_for_fixture
        FROM users u JOIN company_members m USING (user_id)
        WHERE u.username = 'demo.' || fixture.company_login AND m.status = 'active';

        INSERT INTO internship_programs(program_id,company_id,created_by,title,kind,status,summary,
            content_markdown,capacity,application_deadline,published_at,moderation_comment)
        VALUES (md5('showcase-demo-program:' || fixture.n)::uuid,company_id_for_fixture,account_id,
            fixture.title,fixture.kind,fixture.status,fixture.summary,
            fixture.summary || E'\n\n**Формат:** 4 недели с еженедельным разбором. В конце участник показывает результат и инструкцию запуска.',
            fixture.capacity,now() + make_interval(days => 14 + fixture.n),
            CASE WHEN fixture.status = 'published' THEN now() END,
            CASE WHEN fixture.status = 'revision' THEN 'Уточните критерии проверки итоговой работы.' END)
        ON CONFLICT (program_id) DO NOTHING
        RETURNING program_id INTO item_id;

        IF item_id IS NOT NULL AND fixture.status = 'published' THEN
            INSERT INTO internship_applications(program_id,student_id,cover_letter,status,decided_at)
            SELECT item_id,user_id,'Могу выполнить пробное задание и показать учебные проекты.',
                applicant.status,CASE WHEN applicant.status <> 'submitted' THEN now() END
            FROM (VALUES ('demo.student1','submitted'),('demo.student2','accepted'),('demo.student3','rejected'))
                AS applicant(login,status)
            JOIN users ON username = applicant.login
            WHERE fixture.n IN (1,3,5,7,9);
        END IF;
    END LOOP;

    FOR fixture IN SELECT * FROM (VALUES
        (1, 1, 'Панель контроля учебной телеметрии', 'coursework', 'published', 'public', 'Графики показаний и предупреждения о пропусках данных.', 'Go', 'PostgreSQL'),
        (2, 2, 'Планировщик выездных заявок', 'hackathon', 'published', 'public', 'Доска заявок, карта маршрутов и сравнение времени обслуживания.', 'TypeScript', 'React'),
        (3, 3, 'Разбор задач по графам', 'research', 'published', 'public', 'Коллекция реализаций алгоритмов и измерение времени на синтетических графах.', 'Python', 'Git'),
        (4, 4, 'Лабораторный мониторинг сервисов', 'coursework', 'published', 'public', 'Контейнеры, метрики и примеры уведомлений для учебной инфраструктуры.', 'Docker', 'Prometheus'),
        (5, 5, 'Анализатор журналов доступа', 'pet_project', 'published', 'public', 'Загрузка обезличенных журналов и отчёт по повторяющимся ошибкам входа.', 'Python', 'SQL'),
        (6, 6, 'Карта доступности узлов сети', 'coursework', 'published', 'public', 'Визуализация учебной топологии и проверка доступности узлов.', 'Grafana', 'Linux'),
        (7, 7, 'Генератор тестовых API-заявок', 'pet_project', 'published', 'public', 'Создание воспроизводимых заявок для проверки валидации и пагинации.', 'Go', 'Git'),
        (8, 8, 'Витрина статистики публикаций', 'coursework', 'published', 'public', 'Преобразование учебных CSV и витрина по темам и периодам.', 'Python', 'PostgreSQL'),
        (9, 9, 'Проверка качества учебных справочников', 'research', 'moderation', 'public', 'Проверка дубликатов и пропусков с экспортом отчёта.', 'Python', 'SQL'),
        (10, 10, 'Архив конспектов с поиском', 'pet_project', 'published', 'public', 'Локальная индексация конспектов и поиск по тегам.', 'FastAPI', 'Docker'),
        (11, 11, 'Модель прав доступа команды', 'coursework', 'revision', 'public', 'Набор тестов для ролей в учебном сервисе совместной работы.', 'Go', 'Git'),
        (12, 12, 'Интерактивная схема потоков сети', 'hackathon', 'published', 'public', 'Сравнение нагрузки между сегментами на синтетических данных.', 'TypeScript', 'React'),
        (13, 13, 'Прогноз нагрузки учебной энергосистемы', 'research', 'published', 'public', 'Сравнение простых прогнозов и визуализация ошибок по периодам.', 'Pandas', 'scikit-learn'),
        (14, 15, 'Сбор данных с учебных датчиков', 'coursework', 'draft', 'private', 'Конвейер для приёма, нормализации и проверки телеметрии.', 'Grafana', 'Python'),
        (15, 19, 'Карта доступности кампуса', 'coursework', 'published', 'public', 'Слои учебных объектов и маршруты между вымышленными точками.', 'QGIS', 'PostGIS'),
        (16, 20, 'Сервис пространственных выборок', 'pet_project', 'moderation', 'public', 'Запросы к слою учебных объектов по области и типу.', 'PostGIS', 'Docker')
    ) AS projects(n, student_no, title, category, status, visibility, summary, technology_a, technology_b)
    LOOP
        SELECT user_id INTO STRICT account_id FROM users WHERE username = 'demo.student' || fixture.student_no;
        INSERT INTO student_projects(project_id,owner_id,title,category,short_description,full_description,
            problem_solved,status,visibility,tags,published_at,moderation_comment)
        VALUES (md5('showcase-demo-project:' || fixture.n)::uuid,account_id,fixture.title,fixture.category,
            fixture.summary,fixture.summary || E'\n\nВ репозитории автор описал постановку, синтетический набор данных и ручные проверки.',
            'Проверить, что учебное решение воспроизводится и даёт предсказуемый результат.',
            fixture.status,fixture.visibility,jsonb_build_array(fixture.technology_a,fixture.technology_b),
            CASE WHEN fixture.status = 'published' THEN now() END,
            CASE WHEN fixture.status = 'revision' THEN 'Добавьте примеры разрешённых и запрещённых действий.' END)
        ON CONFLICT (project_id) DO NOTHING
        RETURNING project_id INTO item_id;

        IF item_id IS NOT NULL THEN
            INSERT INTO student_project_directions(project_id,direction_id)
            SELECT item_id,d.direction_id FROM students s JOIN directions d ON d.name = s.study_direction
            WHERE s.user_id = account_id;
            INSERT INTO student_project_technologies(project_id,technology_id)
            SELECT item_id,technology_id FROM technologies WHERE name IN (fixture.technology_a,fixture.technology_b);
            IF fixture.status = 'published' THEN
                INSERT INTO student_project_likes(project_id,user_id)
                SELECT item_id,user_id FROM users WHERE username IN ('demo.student2','demo.student4','demo.student6')
                    AND user_id <> account_id;
            END IF;
        END IF;
    END LOOP;

    FOR fixture IN SELECT * FROM (VALUES
        (1, 'ufanet', 'Приоритизация заявок техподдержки', 'published', 'Спроектировать очередь обработки учебных заявок с приоритетами и сроками реакции.'),
        (2, 'gazprom', 'Сводка по работе насосного оборудования', 'published', 'Реализовать фильтры и отчёт по синтетическим журналам работы оборудования.'),
        (3, 'ibs', 'Импорт каталога учебных материалов', 'published', 'Разработать импорт CSV с проверкой схемы и отчётом об ошибках.'),
        (4, 'inoseti', 'Проверка обмена данными между сервисами', 'moderation', 'Собрать набор контрактных тестов на вымышленной интеграции.'),
        (5, 'action', 'Поиск похожих учебных публикаций', 'draft', 'Подготовить поиск похожих текстов и сравнить качество на размеченном учебном наборе.')
    ) AS listings(n, company_login, title, status, summary)
    LOOP
        SELECT u.user_id,m.company_id INTO STRICT account_id,company_id_for_fixture
        FROM users u JOIN company_members m USING (user_id)
        WHERE u.username = 'demo.' || fixture.company_login AND m.status = 'active';

        INSERT INTO cases(case_id,company_id,created_by,title,summary,full_brief,type,event_format,work_format,
            participation_mode,admission_mode,capacity,team_size_min,team_size_max,application_deadline,due_at,
            result_requirements,ip_terms)
        VALUES (md5('showcase-demo-case:' || fixture.n)::uuid,company_id_for_fixture,account_id,fixture.title,fixture.summary,
            fixture.summary || ' Используйте синтетические данные и приведите два проверочных примера.',
            'educational','case','remote','individual','selection',6,1,1,now()+interval '18 days',now()+interval '35 days',
            'Прототип, README и тестовые сценарии.','Учебное использование материалов.')
        ON CONFLICT (case_id) DO NOTHING
        RETURNING case_id INTO item_id;

        IF item_id IS NOT NULL THEN
            INSERT INTO case_revisions(case_id,version_no,brief_snapshot,ip_terms_snapshot,created_by)
            VALUES (item_id,1,jsonb_build_object('title',fixture.title,'summary',fixture.summary),
                'Учебное использование материалов.',account_id);
            INSERT INTO case_directions(case_id,direction_id)
            SELECT item_id,direction_id FROM directions WHERE name IN ('Программная инженерия','Прикладная информатика');
            INSERT INTO case_technologies(case_id,technology_id)
            SELECT item_id,technology_id FROM technologies WHERE name IN ('Python','PostgreSQL');
            INSERT INTO case_stages(case_id,ordinal,title,expected_result,due_at)
            VALUES (item_id,1,'Проверка прототипа','Пример запуска и два тестовых сценария.',now()+interval '25 days');
            INSERT INTO evaluation_criteria(case_id,name,max_score,ordinal)
            VALUES (item_id,'Корректность',60,1),(item_id,'Воспроизводимость',40,2);
            IF fixture.status = 'published' THEN
                INSERT INTO case_moderation_events(case_id,case_revision_id,moderator_id,previous_status,new_status,decision,comment)
                SELECT item_id,r.case_revision_id,u.user_id,'moderation','published','approve','Учебная публикация проверена.'
                FROM case_revisions r CROSS JOIN users u
                WHERE r.case_id=item_id AND r.version_no=1 AND u.username='demo.admin';
            END IF;
            UPDATE cases SET status=fixture.status WHERE case_id=item_id;
        END IF;
    END LOOP;
END $$;

COMMIT;
