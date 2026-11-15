\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = showcase,public;

DO $$
DECLARE
    profile record;
    account_id uuid;
    demo_password_hash text;
BEGIN
    IF current_database() <> 'showcase_demo' OR current_user <> 'showcase_demo' THEN
        RAISE EXCEPTION 'Use the isolated showcase_demo database and role';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('showcase-demo-seed-v1'));
    SELECT password_hash INTO STRICT demo_password_hash FROM users WHERE username = 'demo.admin';

    FOR profile IN SELECT * FROM (VALUES
        (13, 'Сабина', 'Мухина', 'ПИЭ-201Б', 2, 'Передовая инженерная школа «Моторы будущего»', 'Прикладная информатика', 'Информационные технологии и искусственный интеллект в перспективных энергетических системах', 'Строю модели энергопотребления и проверяю качество прогнозов.', 'Pandas'),
        (14, 'Игорь', 'Беляев', 'ПИЭ-302Б', 3, 'Передовая инженерная школа «Моторы будущего»', 'Прикладная информатика', 'Информационные технологии и искусственный интеллект в перспективных энергетических системах', 'Готовлю конвейеры обработки телеметрии для учебных проектов.', 'scikit-learn'),
        (15, 'Лейсан', 'Насырова', 'ИКТ-203Б', 2, 'Институт электротехнического инжиниринга', 'Инфокоммуникационные технологии и системы связи', 'Цифровизация, автоматизация и связь', 'Пишу скрипты для обработки показаний и мониторинга учебной сети.', 'Grafana'),
        (16, 'Артём', 'Павлов', 'ИКТ-301Б', 3, 'Институт электротехнического инжиниринга', 'Инфокоммуникационные технологии и системы связи', 'Информационная безопасность инфокоммуникационных систем', 'Обрабатываю сетевые журналы и собираю правила оповещения для лабораторного стенда.', 'Linux'),
        (17, 'Кира', 'Лебедева', 'ПМФ-202Б', 2, 'Физико-технический институт', 'Прикладные математика и физика', 'Моделирование физических процессов и технологий', 'Пишу численные модели и сверяю результаты с лабораторными измерениями.', 'NumPy'),
        (18, 'Дамир', 'Юсупов', 'ПМФ-301Б', 3, 'Физико-технический институт', 'Прикладные математика и физика', 'Моделирование физических процессов и технологий', 'Автоматизирую расчёт погрешностей и строю графики для экспериментов.', 'SciPy'),
        (19, 'Полина', 'Романова', 'КГИ-201Б', 2, 'Институт природы и человека', 'Картография и геоинформатика', 'Тематическое и геоинформационное картографирование', 'Пишу скрипты обработки геоданных и делаю тематические карты.', 'QGIS'),
        (20, 'Ринат', 'Бикбулатов', 'КГИ-302Б', 3, 'Институт природы и человека', 'Картография и геоинформатика', 'Тематическое и геоинформационное картографирование', 'Работаю с пространственными запросами и учебными слоями городской инфраструктуры.', 'PostGIS')
    ) AS profiles(n, first_name, last_name, group_name, course, institute, direction, program, bio, technology)
    LOOP
        INSERT INTO directions(name) VALUES (profile.direction) ON CONFLICT (name) DO NOTHING;
        INSERT INTO technologies(name) VALUES (profile.technology) ON CONFLICT (name) DO NOTHING;

        INSERT INTO users(username,email,password_hash,group_name)
        VALUES ('demo.student'||profile.n,'showcase.demo.student'||profile.n||'@stud.uust.ru',demo_password_hash,profile.group_name)
        ON CONFLICT (username) DO NOTHING
        RETURNING user_id INTO account_id;

        IF account_id IS NOT NULL THEN
            INSERT INTO user_roles(user_id,role_id)
            SELECT account_id,role_id FROM roles WHERE code = 'student';

            INSERT INTO students(user_id,last_name,first_name,institute_name,study_direction,program_name,
                course,group_name,bio,professional_interests,competencies,technologies,links,education_level)
            VALUES (account_id,profile.last_name,profile.first_name,profile.institute,profile.direction,profile.program,
                profile.course,profile.group_name,profile.bio,'["Прикладное программирование","Анализ данных"]',
                '["Работа с Git"]',jsonb_build_array('Python',profile.technology),
                jsonb_build_array(jsonb_build_object('kind','portfolio','url','https://portfolio.example.test/student-'||profile.n)),
                'bachelor');

            INSERT INTO user_consents(user_id,consent_type,version)
            VALUES (account_id,'personal_data','1.0');
        END IF;
    END LOOP;
END $$;

COMMIT;
