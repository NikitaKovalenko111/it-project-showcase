# Демонстрационные данные

Моки находятся в обычной папке frontend ветки feature-frontend.

Запуск из корня репозитория:
    cd frontend
    npm ci
    npm run dev

Используйте мок-режим (VITE_API_MODE=mock). Команда dev:integration запускает режим с API.

Подготовлены 37 вымышленных студентов, 13 компаний, 49 заданий, 15 проектов, 39 заявок, 25 команд и 36 выполнений. Программы стажировок хранятся в src/api/fixtures/programs.ts; интерфейс этой ветки отличается от демоветки frontend по поддержке программ.

Исходники: src/api/fixtures/catalog.ts, builders.ts и programs.ts. Сборка: mockData.ts, showcaseSeed.ts и competitionSeed.ts. Контакты вымышлены, материалы решений доступны локально.

Набор использует ключи localStorage uust_showcase_curated_v1_ и showcase_curated_v1_. Старые данные браузера не читаются и не удаляются. Новые действия в демоверсии сохраняются.

Вход: student, company, curator, admin. Пароль в мок-режиме — любой непустой.
