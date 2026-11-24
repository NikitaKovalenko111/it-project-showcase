INSERT INTO showcase.competencies (name)
VALUES ('Python'), ('ML'), ('SQL'), ('Java'), ('JavaScript'), ('TypeScript'), ('Go'),
       ('C++'), ('C#'), ('React'), ('Git'), ('Docker'), ('PostgreSQL'), ('REST API'),
       ('Тестирование'), ('Анализ данных'), ('UX/UI'), ('Figma'),
       ('Информационная безопасность'), ('Управление проектами')
ON CONFLICT (name) DO NOTHING;
