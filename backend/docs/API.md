# API АИС «Витрина ИТ-проектов»

Статус документа: черновик контракта. Документ фиксирует принятые решения, планируемые маршруты и вопросы, которые необходимо согласовать с фронтендом и заказчиком. Базовый URL API: `/api/v1`.

## Реализованный инфраструктурный фундамент

- Все HTTP-маршруты публикуются под `/api/v1`.
- Публичные и защищённые auth-маршруты регистрируются отдельно; logout защищён access token.
- Реализованы регистрация студента, вход по email/username, ротация refresh token, `GET /auth/me` и административная блокировка пользователя.
- Роли включаются в access token сервером; публичная регистрация всегда назначает только `student`.
- После пяти неудачных попыток вход блокируется на 15 минут. Блокировка пользователя отзывает все его refresh-сессии.
- Добавлены request ID и заголовок `X-Request-ID`.
- Добавлен единый JSON envelope ошибок.
- CORS использует явный список разрешённых origin из конфигурации; wildcard запрещён.
- Схема PostgreSQL создаётся версированными миграциями из `backend/migrations`.
- Применённые миграции фиксируются в `showcase.schema_migrations`; изменение уже применённого SQL обнаруживается по checksum.
- При применении миграций используется PostgreSQL advisory lock, чтобы два экземпляра сервера не изменяли схему одновременно.

Новые миграции именуются `NNNNNN_description.up.sql`. Уже применённые файлы не редактируются; изменение схемы оформляется следующим номером миграции.

## Общие правила

- Обмен данными выполняется по HTTPS.
- JSON используется для обычных запросов и ответов.
- Для загрузки файлов используется `multipart/form-data`; сервер сохраняет объект в MinIO, а в PostgreSQL — метаданные и ключ объекта.
- Даты и время передаются в ISO 8601 в UTC, например `2026-11-01T12:00:00Z`.
- Идентификаторы ресурсов — UUID.
- Канонические статусы и роли API — стабильные английские коды. Русские названия отображаются только интерфейсом.
- Опубликованные бизнес-данные физически не удаляются. Удаление заменяется сменой статуса (`cancelled`, `hidden`, `blocked`, `deleted` и т. п.). Физическое удаление допустимо только для неиспользованного черновика, если это будет отдельно согласовано.

## Авторизация

Защищённые маршруты требуют заголовок:

```http
Authorization: Bearer <access_token>
```

Access token короткоживущий. Refresh token связан с серверной сессией, хранится на сервере только в виде хеша и ротируется при каждом успешном обновлении. При блокировке пользователя все активные сессии должны быть отозваны.

### POST `/auth/login`

Вход по email или username и паролю. Сохраняется действующий контракт backend.

```json
{
  "login": "ivan@example.com",
  "password": "strong-password-1"
}
```

Успешный ответ `200 OK`:

```json
{
  "user_id": "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer"
}
```

Неудачная попытка увеличивает `failed_login_count`. После согласованного числа попыток устанавливается `locked_until`. Для `blocked` и временно заблокированных пользователей токены не выдаются. После успешного входа счётчик сбрасывается.

### POST `/auth/refresh`

```json
{
  "refresh_token": "..."
}
```

Ответ совпадает с ответом login. Старый refresh token после успешной ротации недействителен.

### POST `/auth/logout`

Принимает refresh token и отзывает связанную с ним серверную сессию. Ответ: `204 No Content`.

### POST `/auth/register`

Регистрирует студента. Роль не принимается от клиента: сервер назначает роль `student`. Регистрация сотрудников университета, наставников, администраторов и представителей компаний должна выполняться отдельными административными или invitation-сценариями.

Register принимает JSON. Фотография не включается в эту транзакцию: после регистрации и login клиент загружает её отдельным `PUT /users/me/photo`. Это не удерживает транзакцию PostgreSQL во время сетевой записи в MinIO.

```json
{
  "username": "ivan",
  "email": "ivan@example.com",
  "password": "strong-password-1",
  "last_name": "Петров",
  "first_name": "Иван",
  "patronymic": "Сергеевич",
  "institute": "Институт информатики",
  "direction": "Backend",
  "program": "Программная инженерия",
  "course": 3,
  "group_name": "ИТ-301",
  "phone": "+79000000000",
  "bio": "Разрабатываю backend-сервисы",
  "professional_interests": ["Высоконагруженные системы"],
  "competencies": ["Проектирование API"],
  "technologies": ["Go", "PostgreSQL"],
  "links": [
    {"kind": "github", "url": "https://github.com/example"}
  ],
  "consent_version": "1.0"
}
```

Регистрация атомарно создаёт учётную запись, профиль студента, согласие на обработку персональных данных и серверно назначенную роль. До решения вопроса со справочниками `direction`, `professional_interests`, `competencies` и `technologies` сохраняются как строки/JSON-массивы.

Ответ `201 Created`:

```json
{
  "user_id": "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "message": "User registered successfully"
}
```

Register не создаёт сессию и не выдаёт токены: после регистрации клиент вызывает login.

### GET `/auth/me`

Возвращает текущую учётную запись, роли и профиль. Маршрут защищён auth middleware.

```json
{
  "user_id": "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "username": "ivan",
  "email": "ivan@example.com",
  "status": "active",
  "roles": ["student"],
  "student": {
    "first_name": "Иван",
    "last_name": "Петров",
    "institute": "Институт информатики",
    "course": 3,
    "group_name": "ИТ-301"
  }
}
```

### PATCH `/users/{user_id}/status`

Только для роли `admin`. Поддерживает статусы `active` и `blocked`. При переходе в `blocked` сервер в той же транзакции отзывает все активные refresh-сессии пользователя.

```json
{
  "status": "blocked"
}
```

Успешный ответ: `204 No Content`. Назначение ролей этим endpoint не поддерживается.

## Роли

Канонические коды:

- `admin`;
- `university_staff`;
- `company_representative`;
- `student`;
- `mentor`.

Роли никогда не принимаются из публичного тела регистрации или обновления профиля. Их назначает только сервер после проверки полномочий инициатора.

## Справочники

Реализованы расширяемые справочники:

- `directions` — ИТ-направления;
- `competencies` — профессиональные компетенции;
- `technologies` — технологии, для них дополнительно доступно поле `kind`;
- `team-roles` — роли участников команды.

### GET `/catalogs/{catalog}`

Публичное чтение активных значений. Ответ:

```json
{
  "items": [
    {
      "id": "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
      "name": "Backend",
      "is_active": true,
      "created_at": "2026-11-01T12:00:00Z"
    }
  ]
}
```

### POST `/catalogs/{catalog}`

Только для `admin`. Создаёт новое значение справочника. Русское или английское отображаемое название хранится в `name`; бизнес-объекты должны ссылаться на UUID, а не сравнивать это название как код.

```json
{
  "name": "Go",
  "kind": "programming_language"
}
```

## Компании

Публичные маршруты возвращают только компании со статусом `approved`. Список использует cursor pagination.

### GET `/companies?limit=20&cursor=...`

Возвращает `{items, next_cursor}`. Сортировка стабильная: `created_at DESC, company_id DESC`.

### GET `/companies/{company_id}`

Возвращает публичную карточку одобренной компании. Неодобренная или отсутствующая карточка возвращает `404 company_not_found` и не раскрывает её данные.

### POST `/companies`

Требует серверную роль `company_representative`. Создаёт компанию в статусе `draft` и атомарно добавляет текущего пользователя в `company_members` с правом управления.

```json
{
  "full_name": "ООО Ромашка",
  "short_name": "Ромашка",
  "industry": "Разработка ПО",
  "description": "Описание компании",
  "activities": "Заказная разработка",
  "website": "https://example.com",
  "contacts": "company@example.com",
  "position": "Руководитель проектов"
}
```

`logo_file_id` изначально `null`; логотип загружается отдельным `PUT /companies/{company_id}/logo`. Передавать произвольный `logo_file_id` в теле компании нельзя.

### POST `/companies/{company_id}/submit-moderation`

Управляющий участник переводит `draft` или `rejected` в `pending`. Только `pending` можно одобрить или отклонить; `suspended` допустим только для ранее одобренной компании.

### POST `/companies/{company_id}/member-invitations`

Управляющий участник приглашает существующего активного пользователя: `{"user_id":"...","position":"Менеджер"}`. Роль не принимается от приглашённого: при принятии сервер назначает `company_representative` и разрешение `manage_company`.

### GET/PATCH `/company-member-invitations`

`GET` возвращает приглашения текущего пользователя с cursor pagination и фильтром `status`. `PATCH /company-member-invitations/{id}` принимает `accepted` или `declined`; принятие атомарно создаёт активное членство и серверную роль.

### POST `/companies/{company_id}/student-invitations`

Одобренная компания может пригласить студента по сценарию `case`, `internship`, `interview` или `job`. Для `case_id` сервер проверяет принадлежность кейса компании и его активный статус.

### GET/PATCH `/company-invitations`

Студент получает свои приглашения с cursor pagination и отвечает `accepted` или `declined`. Это приглашение не заменяет заявку и не создаёт execution автоматически.

### PUT `/companies/{company_id}`

Доступен активному участнику компании с серверным разрешением `manage_company`. Изменение уже одобренной карточки переводит её обратно в `pending`, чтобы изменения прошли повторную модерацию. Физического удаления компании нет.

### GET `/companies/moderation?status=pending&limit=20&cursor=...`

Только для `admin`. Возвращает очередь компаний по статусу `pending`, `approved`, `rejected` или `suspended`.

### PATCH `/companies/{company_id}/moderation`

Только для `admin`. Допустимые решения: `approved`, `rejected`, `suspended`.

```json
{
  "status": "approved",
  "comment": "Реквизиты проверены"
}
```

Каждое решение атомарно сохраняется в `moderation_events` вместе с предыдущим статусом, администратором, комментарием и временем. История физически не удаляется.

## Формат ошибок

Все ошибки API возвращаются в едином формате:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "code": "invalid_format",
        "message": "Email has an invalid format"
      }
    ],
    "request_id": "req_01J..."
  }
}
```

Основные категории:

- `400` — неверный JSON, query-параметр или формат файла;
- `401` — отсутствующий, просроченный или неверный токен/логин;
- `403` — пользователь аутентифицирован, но у него нет права на действие;
- `404` — ресурс не найден;
- `409` — конфликт уникальности, версии или недопустимый переход статуса;
- `413` — файл превышает допустимый размер;
- `415` — неподдерживаемый MIME-тип;
- `422` — данные синтаксически корректны, но нарушают бизнес-правила;
- `423` — вход временно заблокирован после серии неверных паролей;
- `429` — превышен лимит запросов или попыток входа;
- `500` — внутренняя ошибка без раскрытия деталей реализации.

Точные error codes должны быть стабильной частью контракта и покрываться тестами.

## Пагинация списков

Текущий фронтенд ожидает от списковых маршрутов обычный массив и не передаёт параметры пагинации. Это означает, что `GET /cases`, `GET /users` или `GET /student-projects` должны были бы каждый раз возвращать все записи. При росте базы это приводит к большим ответам, долгим SQL-запросам, лишнему потреблению памяти и нестабильному времени ответа. Фильтры не решают проблему: популярный фильтр всё равно может вернуть тысячи строк.

Общий модуль пагинации реализован в `internal/transport/http/pagination`. Он содержит парсинг query-параметров, opaque cursor, DTO ответов и преобразование ошибок параметров в общий API error envelope.

### Cursor pagination

Большие изменяемые списки используют cursor pagination:

```http
GET /api/v1/cases?limit=20&cursor=<opaque_cursor>
```

```json
{
  "items": [],
  "next_cursor": null
}
```

Правила:

- `limit` по умолчанию — `20`;
- минимальный `limit` — `1`;
- максимальный `limit` — `100`;
- отсутствие следующей страницы обозначается `next_cursor: null`;
- пустой список возвращается как `items: []`, а не `null`;
- cursor непрозрачен для клиента и привязан к типу ресурса, поэтому cursor студенческих проектов нельзя использовать в `/cases`;
- репозиторий должен использовать стабильную сортировку с уникальным tie-breaker, например `created_at DESC, id DESC`;
- для определения следующей страницы репозиторий запрашивает `limit + 1` строку, но клиенту возвращаются только `limit` элементов.

Общий helper `NewCursorPage` удаляет дополнительную строку из ответа и строит `next_cursor` по последнему возвращаемому элементу. Размер входящего cursor ограничен, чтобы произвольная длинная query-строка не приводила к лишней обработке и выделению памяти.

Cursor предпочтительнее номера страницы для лент, которые меняются во время просмотра: добавление нового кейса не должно сдвигать уже просмотренные записи и создавать дубли.

### Page pagination

Административные таблицы, где нужен переход к конкретной странице и точное количество строк, используют:

```http
GET /api/v1/users?page=1&page_size=20
```

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

`page` по умолчанию равен `1`, `page_size` — `20`, максимальный `page_size` — `100`. Сервер вычисляет SQL offset; `total` получается отдельным count-запросом только для endpoint, которым действительно требуется точное количество.

### Ошибки пагинации

Неверные или повторяющиеся параметры возвращают `400 invalid_query`:

```json
{
  "error": {
    "code": "invalid_query",
    "message": "Query parameters are invalid",
    "details": [
      {
        "field": "limit",
        "code": "out_of_range",
        "message": "Query parameter \"limit\" must be between 1 and 100"
      }
    ],
    "request_id": "..."
  }
}
```

Конфликт с фронтендом: переход от массива к объекту `{items, ...}` требует изменения API-клиента и типов фронтенда. Обсудить на созвоне до реализации списков.

## Кейсы

Кейс — задание компании. Модуль кейсов реализован. Создавать и изменять кейс может только активный участник компании с разрешением `manage_company`; одной роли `company_representative` без членства недостаточно.

Канонический жизненный цикл:

```text
draft -> moderation -> published
  ^          |             |
  |          v             v
  +------ revision      in_progress -> completed
                            |
                            v
                         cancelled
```

`hidden` устанавливается администратором. Переходы выполняются сервером, поэтому клиент не передаёт произвольный `status` в теле создания или редактирования.

Каждое создание и редактирование условий атомарно создаёт append-only запись `case_revisions`. `terms_version` увеличивается сервером. Модерация всегда относится к конкретной версии; после правки опубликованного кейса его статус становится `revision`, и новую версию нужно повторно отправить на модерацию. База запрещает публикацию, если компания не одобрена, текущая версия отсутствует или для неё нет решения `approve`.

### Модель записи

В запросах создания и изменения используются snake_case и UUID справочников:

```json
{
  "company_id": "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "title": "Сервис анализа обращений",
  "summary": "Краткое описание для каталога",
  "full_brief": "Полное условие кейса",
  "type": "educational",
  "difficulty": "intermediate",
  "work_format": "hybrid",
  "participation_mode": "team",
  "admission_mode": "selection",
  "capacity": 3,
  "team_size_min": 2,
  "team_size_max": 5,
  "course_min": 2,
  "course_max": 5,
  "application_deadline": "2027-02-01T18:00:00Z",
  "due_at": "2027-05-30T18:00:00Z",
  "duration": "4 месяца",
  "result_requirements": "Репозиторий, документация и демонстрация",
  "evaluation_rules": "Оценка по критериям качества и полноты",
  "ip_terms": "Права определяются отдельным соглашением",
  "nda_required": false,
  "visibility": "public",
  "direction_ids": ["4bdb38e2-feca-4dd8-9489-cd6648851f44"],
  "required_competencies": [
    {"id": "344e6fd5-76c4-4b73-8c40-3ee15f954c30", "required_level": "middle"}
  ],
  "technology_ids": ["a6aafc7b-e19b-44a9-8c9e-8d7b164f9962"],
  "rewards": [
    {
      "kind": "money",
      "description": "Призовой фонд",
      "prize_fund": 100000,
      "currency": "RUB",
      "prize_places": [
        {"place_no": 1, "amount": 60000},
        {"place_no": 2, "amount": 40000}
      ]
    }
  ],
  "files": [
    {"file_id": "9f6b09fb-b35e-438e-ad2c-2d838dbca711", "visibility": "public"}
  ]
}
```

Допустимая видимость файла: `public`, `participants`, `company`. К кейсу можно прикрепить только активный файл, ранее загруженный текущим пользователем через `POST /files`. Сумма призовых мест не может превышать `prize_fund`; номера мест внутри одной награды уникальны.

`evaluation_criteria` содержит серверные критерии `name`, `weight`, `max_score`, `ordinal`. Порядок уникален внутри кейса, вес и максимум должны быть положительными. Критерии входят в неизменяемый snapshot ревизии.

### GET `/cases?limit=20&cursor=...`

Публичный каталог возвращает только `public`-кейсы в статусах `published`, `in_progress` и `completed`. Ответ использует cursor pagination: `{items, next_cursor}`.

Фильтры: `search`, `company_id`, `direction_id`, `difficulty`, `participation_mode`, `work_format`, `type`, `has_reward`. Cursor привязан к полному набору фильтров: его нельзя переносить в другой запрос.

### GET `/cases/{case_id}`

Публичная карточка по тем же правилам видимости. Отсутствующий, черновой, restricted или скрытый кейс возвращает `404 case_not_found` без раскрытия его существования. В массив `files` публичного ответа входят только файлы с видимостью `public`.

### GET `/cases/{case_id}/files/{file_id}`

Публично выдаёт бинарный файл только для публичного опубликованного/активного/завершённого кейса и только при `case_files.visibility = public`. Для остальных случаев возвращается `404 file_not_found`. Доступ к `participants` и `company` будет добавлен вместе с заявками и executions, где появится проверяемое участие и NDA grant.

### POST `/cases`

Требует роль `company_representative` и членство `manage_company`. Создаёт `draft`, первую неизменяемую версию условий и все связи в одной транзакции. Ответ: `201 Created` с полной моделью кейса.

### GET `/cases/{case_id}/manage`

Возвращает полную карточку независимо от публичности, включая непубличные метаданные файлов. Доступен управляющему участнику компании или администратору.

### PUT `/cases/{case_id}`

Полностью заменяет редактируемые условия, связи со справочниками, награды и файлы; создаёт следующую immutable-версию. Разрешено для `draft`, `revision` и `published`. Редактирование опубликованной версии переводит кейс в `revision`. `company_id` менять нельзя.

### POST `/cases/{case_id}/submit-moderation`

Переводит `draft` или `revision` в `moderation`. Повторная отправка или переход из другого состояния возвращает `409 invalid_case_transition`.

### GET `/cases/moderation?status=moderation&limit=20&cursor=...`

Только `admin`. Возвращает очередь по одному из серверных статусов кейса. Включает restricted-кейсы и непубличные метаданные файлов.

### PATCH `/cases/{case_id}/moderation`

Только `admin`:

```json
{
  "decision": "request_revision",
  "comment": "Уточните критерии оценки"
}
```

Решения: `approve`, `request_revision`, `reject`, `hide`. Для `request_revision` и `reject` комментарий обязателен. `approve` переводит текущую модерируемую версию в `published`; `request_revision` и `reject` — в `revision`; `hide` — в `hidden`. Каждое решение сохраняется в append-only истории. Одобрить кейс неодобренной компании нельзя.

### PATCH `/cases/{case_id}/status`

Управляющий участник компании может передать только `{"status":"cancelled"}`. Физического удаления и `DELETE /cases/{id}` нет.

Ошибки модуля: `404 case_not_found`, `403 case_access_denied`, `409 invalid_case_transition`, `422 validation_failed`, `422 case_reference_not_found`.

### GET/POST/DELETE `/cases/{case_id}/stages`

Публичный `GET` возвращает `{items: []}` для доступного кейса. Управляющий участник может добавлять и удалять шаблонные этапы только пока кейс находится в `draft` или `revision`; удаление — `DELETE /cases/{case_id}/stages/{stage_id}`. При создании execution этапы копируются в `execution_stages`; поздно добавленный этап также атомарно добавляется существующим выполнениям этого кейса.

## Команды

Командный модуль реализован. Участником может быть только пользователь с серверной ролью и профилем `student`. Добавление участника выполняется через приглашение и явное принятие: лидер не может включить другого студента в команду без его действия.

### POST `/teams`

Только `student`. Создаёт команду, назначает текущего пользователя лидером и первым участником.

```json
{"name":"Backend Crew"}
```

### GET `/teams/{team_id}`

Доступен активному участнику команды или администратору. Возвращает состав, роли участников и даты вступления. Постороннему пользователю возвращается `403 team_access_denied`.

### POST `/teams/{team_id}/invitations`

Только лидер активной команды:

```json
{
  "student_id":"5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "role_id":"4bdb38e2-feca-4dd8-9489-cd6648851f44"
}
```

`role_id` необязателен и должен ссылаться на активное значение `team-roles`. Нельзя пригласить самого себя, действующего участника или создать второе pending-приглашение тому же студенту.

### GET `/team-invitations?status=pending&limit=20&cursor=...`

Возвращает приглашения текущего студента. Статусы: `pending`, `accepted`, `declined`, `revoked`. Используется cursor pagination.

### PATCH `/team-invitations/{invitation_id}`

Приглашённый студент передаёт `{"status":"accepted"}` или `{"status":"declined"}`. При принятии он атомарно добавляется в команду. Если у команды есть незавершённая заявка, для которой новый участник ещё не согласился с условиями, заявка возвращается в `consent_pending`.

## Заявки

Заявка фиксирует текущую неизменяемую `case_revision`. Имена, email, курс, институт и принадлежность к команде не принимаются от клиента как доказательство личности: сервер получает их из access token и БД.

### POST `/applications`

Только `student`. Индивидуальная заявка:

```json
{
  "case_id":"5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "applicant_type":"individual",
  "cover_letter":"Готов выполнить кейс",
  "resume_file_id":"4bdb38e2-feca-4dd8-9489-cd6648851f44",
  "portfolio_url":"https://example.com/portfolio",
  "github_url":"https://github.com/example"
}
```

Для командной заявки передаются `applicant_type: "team"` и `team_id`. Отправить её может только лидер. Сервер проверяет `participation_mode`, диапазон `team_size_min/max`, дедлайн, доступную `capacity`, статус кейса и отсутствие другой активной заявки.

Резюме сначала загружается через `POST /files`; произвольный внешний URL файла не принимается. Индивидуальная заявка сразу получает `submitted`. Командная заявка получает `consent_pending`, пока каждый активный участник не подтвердит зафиксированную версию условий.

### GET `/applications?mine=true&case_id=...&status=...&limit=20&cursor=...`

Студент видит свои индивидуальные и командные заявки. Управляющий участник компании видит заявки на кейсы своей компании; `mine=true` дополнительно включает его собственные заявки, если у пользователя несколько ролей. `admin` видит все. Ответ использует cursor pagination.

### GET `/applications/{application_id}`

Доступен заявителю, активному участнику команды, управляющему участнику компании-владельца или администратору.

### POST `/applications/{application_id}/consents`

Текущий активный участник команды подтверждает именно `case_revision_id`, сохранённый в заявке. Повторно использовать согласие для новой версии кейса нельзя. Когда согласились все активные участники, статус атомарно меняется с `consent_pending` на `submitted`.

### PATCH `/applications/{application_id}/status`

Представитель компании может установить `info_requested`, `interview`, `accepted` или `rejected` и передать `notes`. Заявитель или лидер команды может установить только `withdrawn`.

```json
{
  "status":"accepted",
  "notes":"Приглашаем команду к работе"
}
```

При `accepted` сервер в одной транзакции:

1. блокирует кейс и повторно проверяет `capacity` и размер команды;
2. проверяет согласие каждого текущего участника с версией условий;
3. создаёт ровно один `execution`;
4. копирует согласованный состав в `execution_members`;
5. переводит кейс из `published` в `in_progress`.

Повторное принятие не создаёт второй execution. Если мест нет, состав команды изменился или не хватает согласий, возвращается конфликт.

### GET `/applications/{application_id}/resume`

Защищённая выдача файла резюме. Доступ имеют заявитель, активные участники команды, управляющий участник компании-владельца и администратор. Ответ помечается `private, no-store`.

## Выполнения

Выполнение (`execution`) — отдельная работа конкретного студента или зафиксированного состава команды по принятой заявке.

```text
case -> application -> execution -> submission -> evaluation
```

Один кейс может иметь несколько выполнений и несколько версий результата. Поэтому результат и оценка адресуются через execution/submission, а не только через case.

### GET `/executions/{execution_id}`

Возвращает execution и зафиксированный состав. Доступен участнику выполнения, управляющему участнику компании-владельца или администратору.

### GET `/executions/{execution_id}/stages`

Возвращает прогресс этапов. Участник выполняет переходы `pending|revision -> in_progress -> submitted`. Управляющий участник компании принимает `submitted -> accepted` или возвращает `submitted -> revision` с feedback. После принятия последнего этапа execution автоматически становится `done`.

### PATCH `/executions/{execution_id}/status`

Участник начинает принятое выполнение переходом в `in_progress`. Компания может отменить активное выполнение либо закрыть `done` переходом в `closed`. Даты начала и завершения ставит сервер.

### GET/POST `/executions/{execution_id}/comments`

Комментарии доступны участникам выполнения, управляющим представителям компании и администратору. Список использует cursor pagination; пустой список — `200` и `items: []`. Комментарий можно связать с `stage_id`, причём БД проверяет принадлежность этапа тому же кейсу.

### GET/POST `/executions/{execution_id}/mentors`

Компания назначает наставника только пользователю с серверной ролью `mentor` или `university_staff`. Участники выполнения могут читать список наставников.

### POST/GET `/cases/{case_id}/nda-grants`

Студент создаёт запрос NDA только для кейса с `nda_required=true`; компания и администратор видят список. `PATCH /nda-grants/{id}` устанавливает `granted`, `rejected` или `revoked`. Evidence-файл должен быть активным и принадлежать представителю, выполняющему решение.

### GET `/cases/{case_id}/protected-files/{file_id}`

Файл `company` доступен управляющему участнику компании или администратору. Файл `participants` доступен активному участнику execution; для NDA-кейса дополнительно требуется действующий `granted`. Неуспешная проверка маскируется как `404 file_not_found`.

Результаты и оценки реализованы каноническими маршрутами `/executions/{id}/submissions` и `/submissions/{id}/evaluations`; полный контракт приведён ниже.

Старые frontend-маршруты `/cases/{caseId}/submission` и `/cases/{caseId}/evaluation` неоднозначны при нескольких исполнителях. Для переходного периода можно добавить агрегированное представление, но канонический API должен использовать execution и submission.

### Отсутствующий результат или оценка

Mock-фронтенд может вернуть JavaScript `undefined`, но HTTP/JSON не имеет значения `undefined`. Поэтому серверный контракт должен явно различать ситуации:

- коллекция результатов/оценок существует, но пуста — `200 OK` и `items: []`;
- запрошен конкретный UUID, которого нет — `404` с `submission_not_found` или `evaluation_not_found`;
- запрошен специальный маршрут `latest`, но результат ещё не создан — рекомендуемый вариант `404` с доменным кодом `submission_not_created`; вариант `200` с `null` возможен, но должен быть согласован с фронтендом;
- результат существует, но пользователь не имеет права его видеть — `403`, а не пустой ответ.

Предпочтение: использовать коллекционные маршруты с пустым массивом и не вводить неоднозначные nullable-ответы без необходимости.

## Результаты, оценки, награды и сертификаты

Этап 10 реализован вокруг конкретного `execution`. Один execution имеет несколько последовательных версий результата. Номер версии назначает сервер; предыдущая активная версия того же типа получает `superseded`.

### GET/POST `/executions/{execution_id}/submissions`

Требуется участие в execution, управление компанией-владельцем или роль `admin`. Список использует cursor pagination и при отсутствии результатов возвращает `200` с `items: []`. Создавать результат может только активный участник. Файлы сначала загружаются через `POST /files`, затем передаются как `file_id`; сервер проверяет владельца каждого файла.

```json
{
  "stage_id": null,
  "kind": "final",
  "title": "Итоговая версия",
  "description": "Описание результата",
  "repository_url": "https://github.com/example/project",
  "demo_url": "https://demo.example.com",
  "files": [{"file_id": "uuid", "kind": "presentation", "ordinal": 1}]
}
```

`kind`: `stage` или `final`. Для `stage` обязателен `stage_id` того же кейса. Статусы: `submitted`, `accepted`, `revision`, `superseded`.

### GET `/submissions/{submission_id}`

Возвращает конкретную версию. Неизвестный UUID — `404 submission_not_found`; существующий закрытый результат без прав — `403 permission_denied`.

### GET `/submissions/{submission_id}/files/{file_id}`

Защищённая выдача файла участнику execution, управляющему представителю компании или администратору. Ответ `private, no-store`.

### GET/POST `/submissions/{submission_id}/evaluations`

Пустой список — `200` и `items: []`. Оценку создаёт управляющий представитель компании. `scores` содержит уникальные `criterion_id`, относящиеся к тому же кейсу; БД запрещает балл выше `max_score`. `total_score` вычисляет сервер как сумму `score * weight` и не принимает его от клиента.

```json
{
  "feedback": "Хорошая реализация",
  "scores": [{"criterion_id": "uuid", "score": 8.5, "comment": "Комментарий"}]
}
```

`GET /evaluations/{evaluation_id}` возвращает конкретную оценку; неизвестная оценка — `404 evaluation_not_found`.

### GET/POST `/submissions/{submission_id}/reviews`

История review append-only. Решения: `accept`, `request_revision`, `comment`. Первые два меняют статус submission, `comment` оставляет статус без изменения.

### GET/POST `/executions/{execution_id}/awards`

Награда создаётся компанией только для завершённого execution. Денежная сумма не может быть отрицательной, валюта передаётся стабильным трёхбуквенным кодом. Fulfillment создаётся сервером в `pending`.

`PATCH /awards/{award_id}/fulfillment` переводит fulfillment в `pending`, `in_progress`, `fulfilled` или `cancelled`. Evidence передаётся как принадлежащий представителю `evidence_file_id`; дату выполнения ставит сервер.

### GET/POST `/executions/{execution_id}/certificates`

Сертификат выдаётся участнику завершённого execution. PDF или изображение сначала загружается в MinIO, затем передаётся `file_id`. Пара `(execution_id, student_id)` уникальна, `verification_code` глобально уникален.

## Студенческие проекты

### GET `/student-projects`

Публичный cursor-paginated список опубликованных проектов. Фильтры: `search`, `category`, `direction_id`, `limit`, `cursor`. Пустой список — `200` с `items: []`. `likes_count` вычисляется сервером из `student_project_likes`; клиент не может его установить.

Категории: `coursework`, `pet_project`, `startup`, `research`, `hackathon`, `other`.

### GET `/student-projects/{project_id}`

Публично возвращает только `published`. В ответ входят UUID направлений и технологий, участники, assets и актуальный `likes_count`.

### POST `/student-projects`

Требует роль `student`. Автор определяется только по access token. Создаётся `draft`; владелец автоматически добавляется в `project_members` с ролью `Owner`. Направления и технологии принимаются как UUID справочников. `cover_file_id` и assets должны принадлежать автору и быть активными файлами MinIO.

### PUT `/student-projects/{project_id}`

Владелец может редактировать только `draft` или `revision`. Физического удаления нет.

### POST `/student-projects/{project_id}/submit-moderation`

Переход `draft|revision -> moderation`.

### PATCH `/student-projects/{project_id}/moderation`

Требует `admin`. Решения: `published`, `revision`, `hidden`. Каждое решение сохраняется в append-only истории; дату публикации устанавливает сервер.

### PUT/DELETE `/student-projects/{project_id}/like`

Требует access token. Уникальность `(project_id, user_id)` делает повторный PUT идемпотентным. Ответ содержит `liked` и вычисленный `likes_count`.

### GET `/student-projects/{project_id}/files/{file_id}`

Публично выдаёт cover или asset только опубликованного проекта. Постоянные публичные MinIO URL не хранятся.

## Файлы и MinIO

Фронтенд передаёт бинарный файл, а не произвольный внешний URL. Сервер:

1. проверяет размер, MIME-тип и права;
2. сохраняет объект в MinIO;
3. сохраняет в PostgreSQL ключ объекта, оригинальное имя, MIME-тип, размер, checksum и автора загрузки;
4. связывает файл с кейсом, результатом, проектом или профилем;
5. выдаёт файл только после проверки прав, включая NDA для закрытых материалов.

Прямые постоянные публичные MinIO URL в бизнес-объектах не хранятся. Для скачивания сервер может использовать защищённый endpoint или короткоживущую подписанную ссылку.

Файловый модуль реализован. При запуске сервер проверяет bucket и создаёт его, если он отсутствует. MinIO должен быть доступен до старта HTTP-сервера.

Для локальной разработки MinIO запускается из каталога `backend`. Публичные community-образы MinIO были удалены из Docker Hub, поэтому compose собирает зафиксированный открытый release из официального исходного кода. Первая сборка скачивает Go-зависимости и может занять несколько минут; последующие запуски используют Docker cache.

```powershell
docker compose build minio
docker compose up -d minio
docker compose ps
```

API MinIO доступен на `http://localhost:9000`, web-консоль — на `http://localhost:9001`. Логин `showcase`, пароль `showcase-development-secret`. Данные сохраняются в Docker volume `minio-data`. Остановка без удаления данных: `docker compose down`; остановка с удалением локальных объектов: `docker compose down -v`.

Настройки:

- `object_storage.endpoint` / `minio_endpoint`;
- `object_storage.access_key` / `minio_access_key`;
- `object_storage.secret_key` / `minio_secret_key`;
- `object_storage.bucket` / `minio_bucket`;
- `object_storage.use_ssl` / `minio_use_ssl`;
- `object_storage.region` / `minio_region`;
- `object_storage.max_file_size` / `max_file_size` — байты, сейчас в конфигурации `20971520` (20 MiB).

Сервер определяет MIME по сигнатуре содержимого и не доверяет `Content-Type` клиента. Общая загрузка допускает JPEG, PNG, WebP, PDF, plain text и ZIP. Для фото профиля и логотипа компании допускаются только JPEG, PNG и WebP.

### POST `/files`

Требует access token. Формат `multipart/form-data`, обязательное поле `file`. Ответ `201 Created` содержит `file_id`, исходное имя, определённый MIME, размер, SHA-256, владельца и время загрузки. `storage_key` клиенту не раскрывается.

```json
{
  "file_id": "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1",
  "original_name": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 42819,
  "checksum_sha256": "...",
  "uploaded_by": "a29d3aef-e410-45a0-a756-0cc92c24113e",
  "created_at": "2026-11-01T12:00:00Z"
}
```

### GET `/files/{file_id}`

Требует access token. Файл доступен загрузившему пользователю или `admin`. Неавторизованный доступ маскируется как `404 file_not_found`, чтобы не раскрывать существование объекта.

### PUT `/users/me/photo`

Требует access token студента. Принимает `multipart/form-data` с полем `file`, сохраняет изображение и возвращает метаданные файла. `GET /auth/me` после этого содержит `student.photo_file_id`. При замене предыдущая запись помечается `deleted`, а объект удаляется из MinIO после успешного коммита.

### PUT `/companies/{company_id}/logo`

Требует роль `company_representative`, активное членство в компании и серверное разрешение `manage_company`. Изменение логотипа одобренной компании переводит карточку обратно в `pending`.

### GET `/companies/{company_id}/logo`

Публично отдаёт логотип только компании в статусе `approved`. Для остальных случаев возвращается `404 file_not_found`.

### GET `/cases/{case_id}/files/{file_id}`

Публично отдаёт только файл с видимостью `public`, прикреплённый к публичному кейсу в статусе `published`, `in_progress` или `completed`. Непубличные файлы не попадают в публичную модель кейса.

### GET `/cases/{case_id}/protected-files/{file_id}`

Требует access token и проверяет компанию, участие в execution и NDA grant. Ответ всегда `private, no-store`.

Если MinIO принял новый объект, но PostgreSQL отклонил запись или привязку, сервер выполняет компенсационное удаление объекта. Метаданные заменённых файлов сохраняют статус `deleted`; это позволяет не терять историю ссылок, при этом бинарный объект старой версии очищается.

Файловые ошибки:

- `400 file_required` или `invalid_multipart`;
- `404 file_not_found`;
- `413 file_too_large`;
- `415 unsupported_file_type`;
- `422 invalid_file`.

## Канонические значения

### Роли

`admin`, `university_staff`, `company_representative`, `student`, `mentor`.

### Состояние пользователя

`active`, `blocked`, `deleted`.

### Статус кейса

`draft`, `moderation`, `revision`, `published`, `in_progress`, `completed`, `cancelled`, `hidden`.

### Решение по кейсу

`approve`, `request_revision`, `reject`, `hide`.

### Компания

`draft`, `pending`, `approved`, `rejected`, `suspended`.

### NDA

`pending`, `granted`, `revoked`, `rejected`.

### Заявка

`consent_pending`, `submitted`, `info_requested`, `interview`, `accepted`, `rejected`, `withdrawn`.

### Команда

`active`, `disbanded`.

### Приглашение в команду

`pending`, `accepted`, `declined`, `revoked`.

### Выполнение

`accepted`, `in_progress`, `submitted`, `review`, `revision`, `done`, `closed`, `cancelled`.

### Этап выполнения

`pending`, `in_progress`, `submitted`, `accepted`, `revision`.

### Формат участия

`individual`, `team`, `both`.

### Формат работы

`remote`, `onsite`, `hybrid`.

## Конфликты ТЗ и текущего фронтенда — обсудить на созвоне

1. Текущий фронтенд выполняет login только по username без пароля. ТЗ требует защищённую аутентификацию. Серверный контракт остаётся `login + password`, где login — email или username.
2. Фронтенд ожидает `{user, token}`, backend возвращает `user_id`, `access_token`, `refresh_token`, `token_type`. Принято сохранить backend-ответ; фронтенд нужно изменить.
3. Фронтенд разрешает передать роль при регистрации. По требованиям безопасности роль назначает только сервер.
4. Фронтенд передаёт название института строкой. На первом этапе это допускается, но нужно решить, когда и как перейти к `education_orgs -> faculties -> programs`. До решения нельзя считать строку надёжным идентификатором организации.
5. API фронтенда передаёт `direction`, `competencies` и `technologies` строками/массивами строк. Для кейсов сервер уже использует UUID (`direction_ids`, `required_competencies[].id`, `technology_ids`) и many-to-many связи. Register студента пока сохраняет строки; единый переход профиля на UUID нужно согласовать.
6. Фронтенд передаёт `likesCount`, но сервер его игнорирует: реализована `student_project_likes` с уникальностью `(project_id, user_id)`, а `likes_count` вычисляется сервером.
7. Поля `badges` фронтенда не имеют прямого аналога в схеме. Нужно определить, это хранимые модератором отметки, вычисляемые признаки или замена `seeking_flags`.
8. Фронтенд сейчас передаёт ссылки на файлы. Сервер уже требует сначала multipart upload в MinIO, затем `file_id`; это реализовано и для файлов кейса. Фронтенд нужно изменить.
9. Фронтенд ожидает массивы без пагинации. Целевые ответы больших списков будут содержать `items` и cursor/page metadata.
10. Фронтенд объединяет кейс и конкретное выполнение в одной модели. Сервер разделяет `case` и `execution`; frontend-модели и маршруты нужно адаптировать.
11. Маршруты результата и оценки только по `caseId` неоднозначны, когда у кейса несколько исполнителей.
12. Фронтенд использует другой набор ролей и статусов (`company`, `curator`, `pending`, `need_info`, русские значения форматов). Нужен переход на канонические серверные коды из этого документа.
13. Фронтенд содержит `DELETE /cases/{id}`. Сервер его не реализует: `PATCH /cases/{id}/status` со значением `cancelled` сохраняет историю и данные.
14. Нужно согласовать поведение UI для пустых результатов и оценок: пустая коллекция, доменный 404 для `latest` или nullable-ответ.
15. Frontend-поля кейса используют camelCase и другие имена (`shortDescription`, `fullDescription`, `complexity`, `participationFormat`, `teamSize`, `recommendedTech`, `deadlineDate`, `evaluationOrder`, `isConfidential`). Сервер использует канонические snake_case-поля (`summary`, `full_brief`, `difficulty`, `participation_mode`, `team_size_min/max`, `technology_ids`, `application_deadline`/`due_at`, `evaluation_rules`, `nda_required`/`visibility`). Нужен явный маппинг в API-клиенте.
16. Фронтенд сводит модерацию к полям `status`/`isModerated`. Сервер отделяет жизненный статус кейса от append-only решения модератора конкретной версии.
17. Фронтенд передаёт в заявке `studentId`, имя, email, телефон, курс и институт. Сервер игнорирует такие клиентские утверждения и определяет заявителя по access token; контракт принимает только содержательные поля заявки.
18. Frontend использует `resumeUrl`. Сервер использует `resume_file_id` после multipart-загрузки и отдельный защищённый endpoint скачивания.
19. Во frontend нет этапа согласия каждого участника команды с конкретной версией условий. Сервер вводит `consent_pending` и `/applications/{id}/consents`; UI нужно дополнить.

## Расхождения текущей реализации backend и целевого API

После 3-го этапа auth-контур реализован. Остаются следующие переходные решения:

1. Старые nullable-колонки `group_name` и `image_url` сохранены в `users` только для совместимости миграции. Новый код их не использует; удалить их нужно отдельной миграцией после проверки существующих данных.
2. Учебные данные вынесены в `students`, но институт и направление временно строковые, а интересы, компетенции и технологии — JSON-массивы. Нормализация через справочники ожидает решения на созвоне.
3. Фото профиля, логотип компании, файлы кейсов, submissions и студенческих проектов сохраняются через `files` и MinIO; предметные таблицы содержат только `file_id`.
4. Публичного endpoint назначения ролей нет. Регистрация назначает `student`; будущие административные сценарии ролей должны иметь отдельный аудит.
5. Access token не отзывается мгновенно и действует до короткого срока истечения; блокировка немедленно отзывает серверные refresh-сессии.
6. Для создания компании пользователь уже должен иметь серверную роль `company_representative`. Нужно согласовать отдельный административный или invitation-сценарий первичной выдачи этой роли; публичное тело запроса роль не принимает.

После 4-го этапа добавлены справочники, компании, членство представителей и история модерации. Связь профиля студента со справочниками намеренно не менялась до решения перечисленных выше конфликтов со строковыми полями фронтенда.

После 5-го этапа добавлены MinIO, метаданные файлов, защищённая общая загрузка, фотографии студентов и логотипы компаний. Внешние URL не используются как замена загруженному файлу.

Этапы 6–11 реализованы: компании и представители с явной модерацией, кейсы с ревизиями и критериями, команды и заявки с согласиями, executions, submissions и оценки, награды и сертификаты, а также модерируемые студенческие проекты с участниками, файлами и серверными лайками. Следующий блок по плану — этап 12: избранное, уведомления, аудит, поиск студентов, портфолио, аналитика и экспорт.

## Инфраструктурные изменения API

Префикс `/api/v1`, CORS allowlist, auth/role middleware, request ID, единый error response и версионированные миграции уже подключены. Проверка принадлежности конкретного бизнес-ресурса добавляется вместе с соответствующим модулем.

