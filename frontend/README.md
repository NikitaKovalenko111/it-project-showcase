# API бэкенда — витрина IT-проектов

Документ описывает запросы, которые ожидает текущий фронтенд. Серверной реализации в репозитории нет. Источник контракта: `frontend/src/api/client.ts`; структуры ответов: `frontend/src/types/models.ts`.

## Подключение

Создайте `frontend/.env.local`:

```env
VITE_API_MODE=live
VITE_API_URL=http://localhost:8080/api/v1
VITE_API_TIMEOUT_MS=15000
```

Адрес и порт приведены для примера. После изменения настроек перезапустите фронтенд. По умолчанию используется `mock`; в режиме `live` без адреса запросы идут на `/api/v1` текущего сайта. Для разных адресов фронтенда и сервера настройте CORS на сервере.

Все пути ниже указаны относительно базового URL. Тела запросов и ответы — JSON. Клиент отправляет `Content-Type: application/json`, `Accept: application/json` и, если токен сохранён, `Authorization: Bearer <token>`. При HTTP 401 токен удаляется. Списки ожидаются обычными массивами, отдельные сущности — объектами, без обёртки `data`.

## Запросы, подключённые в live-режиме

Обозначения типов соответствуют `frontend/src/types/models.ts`. Поля с `?` необязательны. Для методов с произвольным `data` ниже указан ориентир по моделям и формам; строгие серверные DTO и правила валидации пока не определены.

### Авторизация и пользователи

| Метод | Путь | Тело | Ответ |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ username }` | `{ user: User, token: string }` |
| POST | `/auth/register` | Данные регистрации (пример ниже) | `{ user: User, token: string }` |
| GET | `/auth/me` | — | `User` |
| GET | `/users` | — | `User[]` |
| PUT | `/users/{id}` | Полный `User` | `User` |
| POST | `/users/{id}/toggle-block` | — | `User` |
| POST | `/users/{id}/change-role` | `{ role }` | `User` |

Роли: `admin`, `university`, `company`, `student`, `curator`. Текущий вход передаёт только `username`, без пароля. Выход выполняется локально и HTTP-запроса не отправляет. Форма регистрации сейчас обращается напрямую к mockServer, хотя метод `/auth/register` уже предусмотрен в API-клиенте.

Пример тела регистрации по текущей форме:

```json
{
  "username": "ivan",
  "fullName": "Иван Петров",
  "email": "ivan@example.com",
  "phone": "+79000000000",
  "role": "student",
  "group": "ИТ-301",
  "institute": "Институт информатики"
}
```

Для представителя компании форма использует `role: "company"` и `companyName` вместо `group` и `institute`.

### Кейсы и компании

| Метод | Путь | Параметры / тело | Ответ |
| --- | --- | --- | --- |
| GET | `/cases` | Query-фильтры ниже | `CaseProject[]` |
| GET | `/cases/{id}` | — | `CaseProject` |
| POST | `/cases` | Данные кейса | `CaseProject` |
| PUT | `/cases/{id}` | Полный `CaseProject` | `CaseProject` |
| DELETE | `/cases/{id}` | — | Тело не используется |
| PATCH | `/cases/{id}/moderation` | `{ status, comment }` | `CaseProject` |
| GET | `/companies` | — | `Company[]` |
| GET | `/companies/{id}` | — | `Company` |

Фильтры кейсов по текущей mock-реализации: `search`, `direction`, `complexity`, `participationFormat`, `workFormat`, `rewardType`, `status`, `companyId`, `hasReward`. API-клиент передаёт полученные фильтры как query-параметры. Пагинация в контракте клиента не предусмотрена.

Основные поля кейса: `title`, `companyId`, `companyName`, `companyLogo`, `shortDescription`, `fullDescription`, `direction`, `complexity`, `participationFormat`, `teamSize: { min, max }`, `requiredCompetencies: string[]`, `recommendedTech: string[]`, `deadlineDate`, `duration`, `workFormat`, `resultRequirements`, `evaluationOrder`, `rewardType`, `paymentStatus`, `status`, `isConfidential`, `ipRights`, `isModerated`. Полная модель содержит также сведения о призах, назначенных исполнителях, модерации и счётчиках.

### Заявки

| Метод | Путь | Параметры / тело | Ответ |
| --- | --- | --- | --- |
| GET | `/applications` | Query: `caseId?`, `studentId?` | `CaseApplication[]` |
| POST | `/applications` | Данные заявки | `CaseApplication` |
| PATCH | `/applications/{id}/status` | `{ status, notes? }` | `CaseApplication` |

Пример заявки:

```json
{
  "caseId": "case_1",
  "caseTitle": "Разработка сервиса",
  "companyId": "company_1",
  "applicantType": "individual",
  "studentId": "student_1",
  "studentName": "Иван Петров",
  "studentEmail": "ivan@example.com",
  "studentPhone": "+79000000000",
  "studentCourse": 3,
  "studentInstitute": "Институт информатики",
  "coverLetter": "Готов реализовать проект на Python.",
  "resumeUrl": "https://example.com/resume.pdf",
  "portfolioUrl": "https://example.com/portfolio",
  "githubUrl": "https://github.com/example",
  "previousProjects": []
}
```

Для командной заявки: `applicantType: "team"`, `teamId`, `teamName`. Сервер должен проверять личность и права заявителя по токену, а также принадлежность команды; переданные клиентом имена и идентификаторы не являются подтверждением прав.

### Этапы, результаты и оценки

| Метод | Путь | Тело | Ответ |
| --- | --- | --- | --- |
| GET | `/cases/{caseId}/milestones` | — | `ProjectMilestone[]` |
| POST | `/cases/{caseId}/milestones` | `{ title, description, deadline }` | `ProjectMilestone` |
| DELETE | `/milestones/{id}` | — | Тело не используется |
| POST | `/milestones/{id}/submit` | `{ materials: [{ name, url, size? }] }` | `ProjectMilestone` |
| PATCH | `/milestones/{id}/status` | `{ status, feedback? }` | `ProjectMilestone` |
| GET | `/cases/{caseId}/submission` | — | `ProjectSubmission` |
| POST | `/submissions` | Данные результата | `ProjectSubmission` |
| GET | `/cases/{caseId}/evaluation` | — | `ProjectEvaluation` |
| POST | `/evaluations` | Данные оценки | `ProjectEvaluation` |

Тело результата: `caseId`, `authorName`, `description`, `repoUrl`, `screenshots: string[]`, `attachedFiles: [{ name, url }]`; необязательные `studentId`, `teamId`, `presentationUrl`, `videoUrl`, `documentationUrl`, `demoUrl`. Ответ дополнительно содержит `id`, `submittedAt`, необязательный `acceptedAt`.

Тело оценки: `caseId`, `companyId`, `companyName`, `evaluatorName`, `scores`, `totalScore`, `maxScore`, `feedback`, необязательные `winnerPlace`, `nomination`. Ответ дополнительно содержит `id`, `evaluatedAt`.

Объект `scores` содержит числовые поля: `solutionCompleteness`, `implementationQuality`, `codeQuality`, `architecture`, `specCompliance`, `usability`, `originality`, `documentationQuality`, `deadlineCompliance`, `teamwork`. Форма использует максимум 100 баллов суммарно.

Файлы передаются ссылками. HTTP-загрузки файлов через multipart в текущем клиенте нет. Поведение GET при отсутствии результата или оценки ещё нужно согласовать: mock возвращает `undefined`, отдельного контракта live-ответа нет.

### Студенческие проекты

| Метод | Путь | Параметры / тело | Ответ |
| --- | --- | --- | --- |
| GET | `/student-projects` | Query: `search?`, `category?`, `direction?`, `badge?` | `StudentProject[]` |
| GET | `/student-projects/{id}` | — | `StudentProject` |
| POST | `/student-projects` | Данные проекта | `StudentProject` |
| PATCH | `/student-projects/{id}/moderation` | `{ status, comment }` | `StudentProject` |

Основные поля проекта: `title`, `coverImage`, `authorId`, `authorName`, `category`, `shortDescription`, `fullDescription`, `problemSolved`, `technologies: string[]`, `direction`, `status`, `screenshots: string[]`, `badges: string[]`, `isModerated`. Необязательные: `teamName`, `githubUrl`, `productUrl`, `presentationUrl`, `videoUrl`. Полный ответ также содержит `id`, `createdAt`, `likesCount` и сведения о модерации.

## Значения статусов и перечислений

| Поле | Значения |
| --- | --- |
| Модерация | `pending`, `approved`, `rejected`, `revision`, `hidden` |
| Заявка | `pending`, `interview`, `accepted`, `rejected`, `need_info` |
| Этап | `pending`, `in_progress`, `submitted`, `accepted`, `needs_work` |
| Кейс | `open`, `application`, `selection`, `accepted`, `in_progress`, `submitted`, `review`, `revision`, `completed`, `archived`, `moderation` |
| Сложность | `Начальный`, `Средний`, `Высокий` |
| Участие | `individual`, `team`, `both` |
| Формат работы | `дистанционный`, `очный`, `смешанный` |
| Вознаграждение | `educational`, `contest`, `monetary`, `other` |
| Оплата | `not_provided`, `pending`, `confirmed`, `paid` |
| Права на результат | `author`, `exclusive_company`, `non_exclusive_license`, `open_source`, `custom_agreement` |
| Студенческий проект | `в разработке`, `готовый продукт`, `архив` |

Направления, категории проектов и бейджи перечислены в `frontend/src/types/models.ts` (`ProjectDirection`, `StudentProjectCategory`, `StudentProjectBadge`).

## Примеры запросов в PowerShell

Замените адрес, логин и идентификаторы на реальные. Примеры выполняют изменения на подключённом сервере.

```powershell
$apiBase = 'http://localhost:8080/api/v1'
$loginBody = @{ username = 'student' } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/login" -ContentType 'application/json; charset=utf-8' -Body $loginBody
$apiHeaders = @{ Authorization = "Bearer $($session.token)" }

# Текущий пользователь и список кейсов
Invoke-RestMethod -Uri "$apiBase/auth/me" -Headers $apiHeaders
Invoke-RestMethod -Uri "$apiBase/cases?direction=Backend&status=open" -Headers $apiHeaders

# Изменение статуса заявки
$statusBody = @{ status = 'accepted'; notes = 'Приглашаем к работе' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$apiBase/applications/application_1/status" -Headers $apiHeaders -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($statusBody))

# Создание этапа
$milestoneBody = @{ title = 'Разработка MVP'; description = 'Подготовить прототип'; deadline = '2026-12-01' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$apiBase/cases/case_1/milestones" -Headers $apiHeaders -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($milestoneBody))
```

## Функции, для которых HTTP-запросов пока нет

Даже при `VITE_API_MODE=live` следующие методы клиента используют mockServer. URL для них ещё не определены; при реализации бэкенда потребуется также подключить их во фронтенде:

- Избранное: `getFavorites`, `toggleFavorite`.
- NDA: `isNDAAccepted`, `acceptNDA`.
- Лайки проектов: `toggleStudentProjectLike`.
- Верификация компаний: `verifyCompany`.
- Поиск и приглашение студентов: `getStudents`, `inviteStudent`.
- Команды: `getTeams`, `createTeam`.
- Комментарии: `getComments`, `addComment`.
- Уведомления: `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`.
- Журнал действий: `getAuditLogs`.

## Что согласовать при реализации сервера

Серверные маршруты, коды успешных ответов, структура ошибок, обязательность полей создания и матрица доступа пока не закреплены серверным кодом. Клиент явно обрабатывает HTTP 401; остальные ошибки передаются вызывающему коду. На сервере необходимо проверять роли, принадлежность ресурсов и допустимость переходов статусов. Выдачу административных ролей и изменение чужих данных нельзя разрешать на основании тела запроса.
