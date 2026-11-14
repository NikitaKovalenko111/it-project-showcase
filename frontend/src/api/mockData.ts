import type {
  AuditLog,
  CaseApplication,
  ProjectComment,
  ProjectEvaluation,
  ProjectSubmission,
  ProjectTeam,
  SystemNotification,
  User,
} from '../types/models'
import {
  buildStudents,
  buildCompanies,
  buildCases,
  buildPortfolio,
  buildMilestones,
  textAttachment,
} from './fixtures/builders'

// Base records retain stable IDs used by the UI scenarios. All content is fictional.
const students = buildStudents()
const companies = buildCompanies()
export const INITIAL_USERS: User[] = [
  students[0],
  {
    id: 'usr_company_1',
    username: 'company',
    fullName: 'Роман Семёнов',
    email: 'coordinator@promkontur.example',
    role: 'company',
    createdAt: '2026-09-01T09:00:00Z',
    companyProfile: {
      companyId: 'comp_1',
      companyName: companies[0].name,
      position: 'Координатор студенческих проектов',
    },
  },
  {
    id: 'usr_curator_1',
    username: 'curator',
    fullName: 'Елена Ахметова',
    email: 'curator@university.example',
    role: 'curator',
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    id: 'usr_admin_1',
    username: 'admin',
    fullName: 'Наиль Хисамов',
    email: 'admin@showcase.example',
    role: 'admin',
    createdAt: '2026-09-01T09:00:00Z',
  },
  students[1],
  students[2],
]
export const INITIAL_COMPANIES = companies.slice(0, 4)
export const INITIAL_CASES = buildCases().slice(0, 5)
export const INITIAL_STUDENT_PROJECTS = buildPortfolio().slice(0, 3)
export const INITIAL_MILESTONES = buildMilestones(INITIAL_CASES)
export const INITIAL_SUBMISSIONS: ProjectSubmission[] = [
  {
    id: 'sub_1',
    caseId: 'case_1',
    teamId: 'team_alpha',
    studentId: students[0].id,
    authorName: students[0].fullName,
    description:
      'Подготовлена обработка временных рядов и панель датчиков. Сравнили пороговый метод с Isolation Forest; отдельно показали участки с пропущенными измерениями.',
    repoUrl: '',
    screenshots: [],
    attachedFiles: [
      textAttachment(
        'Описание решения.txt',
        'Мониторинг вибрации станков\n\n1. Загрузка CSV с колонками timestamp, sensor_id, value.\n2. Проверка пропусков и дубликатов.\n3. Сравнение порогового метода и Isolation Forest.\n4. Проверка ложных срабатываний на контрольном наборе.\n\nОграничения: прототип работает с учебной выборкой, без подключения к оборудованию.',
      ),
    ],
    submittedAt: '2026-11-11T12:00:00Z',
  },
]
export const INITIAL_EVALUATIONS: ProjectEvaluation[] = []
export const INITIAL_TEAMS: ProjectTeam[] = [
  {
    id: 'team_alpha',
    name: 'Вектор',
    leaderId: students[0].id,
    leaderName: students[0].fullName,
    caseId: 'case_1',
    createdAt: '2026-11-01',
    description: 'Команда разработки интерфейса и обработки телеметрии.',
    members: students.slice(0, 3).map((user, index) => ({
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: ['Капитан', 'Дизайнер интерфейса', 'Инженер телеметрии'][index],
      competencies: user.studentProfile!.skills,
    })),
  },
]
export const INITIAL_APPLICATIONS: CaseApplication[] = students.slice(0, 2).map((user, index) => {
  const project = INITIAL_CASES[index]
  return {
    id: 'app_' + (index + 1),
    caseId: project.id,
    caseTitle: project.title,
    companyId: project.companyId,
    studentId: user.id,
    studentName: user.fullName,
    studentEmail: user.email,
    studentPhone: '',
    studentCourse: user.studentProfile!.course,
    studentInstitute: user.studentProfile!.institute,
    studentGroup: user.studentProfile!.group,
    applicantType: index === 0 ? 'team' : 'individual',
    ...(index === 0 ? { teamId: 'team_alpha', teamName: 'Вектор' } : {}),
    coverLetter:
      index === 0
        ? 'В команде есть разработчик интерфейса и инженер телеметрии. Начнём с проверки качества данных, затем сравним методы поиска аномалий и покажем графики наставнику.'
        : 'Разработала прототип календаря записи. Хочу проверить сценарии пересечения бронирований и перенести макет в рабочее приложение.',
    resumeUrl: '',
    portfolioUrl: '',
    githubUrl: '',
    previousProjects: [INITIAL_STUDENT_PROJECTS[index].title],
    status: index === 0 ? 'accepted' : 'interview',
    companyNotes:
      index === 0
        ? 'Согласован план первого этапа.'
        : 'На встрече обсудим модель бронирований и обработку пересечений.',
    createdAt: '2026-11-05T10:00:00Z',
  }
})
export const INITIAL_COMMENTS: ProjectComment[] = [
  {
    id: 'comm_1',
    caseId: 'case_1',
    authorId: 'usr_curator_1',
    authorName: 'Елена Ахметова',
    authorRole: 'curator',
    content:
      'Для сравнения моделей используйте одну контрольную выборку. В отчёте отдельно покажите ложные срабатывания.',
    createdAt: '2026-11-09T09:00:00Z',
  },
  {
    id: 'comm_2',
    caseId: 'case_1',
    authorId: students[0].id,
    authorName: students[0].fullName,
    authorRole: 'student',
    content:
      'Разделили данные по времени и добавили проверку пропусков. На встрече покажем результаты двух методов на одном наборе.',
    createdAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'comm_3',
    caseId: 'case_1',
    authorId: 'usr_company_1',
    authorName: 'Роман Семёнов',
    authorRole: 'company',
    content:
      'Добавьте в интерфейс объяснение причины предупреждения. Для инженера важно видеть датчик, период и значение порога.',
    createdAt: '2026-11-11T11:00:00Z',
  },
]
export const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif_1',
    userId: students[0].id,
    type: 'application_status',
    title: 'Команда принята в проект',
    message:
      'Заявка команды «Вектор» на мониторинг вибрации принята. План работы доступен в пространстве проекта.',
    read: false,
    link: '/cases/case_1/workspace',
    createdAt: '2026-11-05T11:00:00Z',
  },
  {
    id: 'notif_2',
    userId: students[0].id,
    type: 'new_comment',
    title: 'Наставник оставил комментарий',
    message: 'Уточните, как в интерфейсе показывается причина предупреждения.',
    read: false,
    link: '/cases/case_1/workspace',
    createdAt: '2026-11-11T11:00:00Z',
  },
  {
    id: 'notif_3',
    userId: students[0].id,
    type: 'new_case',
    title: 'Новое задание по интерфейсам',
    message: 'Открыт набор на разработку дизайн-системы учебного портала.',
    read: true,
    link: '/cases/case_5',
    createdAt: '2026-11-10T09:00:00Z',
  },
]
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log_1',
    userId: 'usr_company_1',
    userName: 'Роман Семёнов',
    userRole: 'company',
    timestamp: '2026-11-05T11:00:00Z',
    actionType: 'status_change',
    objectType: 'CaseProject',
    objectId: 'case_1',
    objectName: INITIAL_CASES[0].title,
    details: 'Команда «Вектор» принята, начата работа над проектом.',
  },
]
