import {
  INITIAL_USERS,
  INITIAL_COMPANIES,
  INITIAL_CASES,
  INITIAL_STUDENT_PROJECTS,
  INITIAL_COMMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_MILESTONES,
} from './mockData'
import { competitionSeed } from './competitionSeed'
import type {
  User,
  Company,
  CaseProject,
  StudentProject,
  ProjectComment,
  AuditLog,
  ProjectMilestone,
} from '../types/models'

export function showcaseSeed() {
  const competition = competitionSeed()
  const users: User[] = structuredClone([...INITIAL_USERS, ...competition.users])
  const surnames = [
    'Андреев',
    'Белов',
    'Власов',
    'Громов',
    'Денисов',
    'Захаров',
    'Исаев',
    'Калинин',
    'Лебедев',
    'Марков',
    'Николаев',
  ]
  const names = [
    'Александр',
    'Борис',
    'Вадим',
    'Григорий',
    'Денис',
    'Егор',
    'Иван',
    'Кирилл',
    'Лев',
    'Матвей',
    'Николай',
  ]
  for (let i = 0; users.filter((user) => user.role === 'student').length < 37; i++) {
    const template = structuredClone(INITIAL_USERS[0])
    users.push({
      ...template,
      id: 'showcase_student_' + i,
      username: 'student_demo_' + (i + 1),
      fullName: names[i % names.length] + ' ' + surnames[i % surnames.length],
      email: 'student' + (i + 1) + '@stud.uust.ru',
      avatar: undefined,
      phone: '',
      studentProfile: {
        ...template.studentProfile!,
        course: 1 + (i % 4),
        group: ['ПИ-101', 'ИВТ-202', 'ПМИ-303', 'ИБ-404'][i % 4],
        curatorId: i % 2 ? 'usr_curator_1' : 'showcase_curator',
        bio: [
          'Разрабатываю веб-приложения.',
          'Интересуюсь анализом данных.',
          'Изучаю тестирование и автоматизацию.',
        ][i % 3],
        phone: '',
        githubUrl: '',
        portfolioUrl: '',
        rating: 0,
        winsCount: 0,
        verifiedProjectsCount: 0,
        skills: [
          ['React', 'TypeScript'],
          ['Python', 'SQL'],
          ['Go', 'Docker'],
        ][i % 3],
        techStack: [
          ['React', 'TypeScript'],
          ['Python', 'PostgreSQL'],
          ['Go', 'Docker'],
        ][i % 3],
      },
    })
  }
  const companies: Company[] = structuredClone(INITIAL_COMPANIES)
  const companyNames = [
    'Северный Вектор',
    'Лаборатория Щит',
    'Цифровой маршрут',
    'Спектр данных',
    'Городские сервисы',
    'Код решений',
    'Урал Роботикс',
    'Облачные системы',
    'Пульс технологий',
  ]
  for (let i = 0; companies.length < 13; i++) {
    companies.push({
      ...structuredClone(INITIAL_COMPANIES[i % INITIAL_COMPANIES.length]),
      id: 'showcase_company_' + i,
      name: 'ООО «' + companyNames[i] + '»',
      shortName: companyNames[i],
      description: 'Разработка цифровых продуктов и совместные учебные проекты со студентами.',
      email: 'info@company' + i + '.example',
      website: '',
      phone: '',
      contactPerson: 'Представитель компании',
      logo: '/demo/company.svg',
      activeCasesCount: 0,
      completedProjectsCount: 0,
      isVerified: i < 7,
    })
  }
  for (let i = 0; i < 5; i++) {
    users.push({
      id: 'showcase_representative_' + i,
      username: 'company_demo_' + (i + 1),
      fullName: 'Представитель ' + companies[4 + i].shortName,
      email: 'representative' + i + '@example.test',
      role: 'company',
      createdAt: '2026-09-01T09:00:00Z',
      companyProfile: {
        companyId: companies[4 + i].id,
        companyName: companies[4 + i].name,
        position: 'Координатор проектов',
      },
    })
  }
  users.push({
    id: 'showcase_curator',
    username: 'curator_demo',
    fullName: 'Ольга Сергеева',
    email: 'curator@example.test',
    role: 'curator',
    createdAt: '2026-09-01T09:00:00Z',
  })
  const cases: CaseProject[] = structuredClone(INITIAL_CASES)
  const topics = [
    ['Карта доступности городских сервисов', 'Frontend', ['React', 'TypeScript']],
    ['Анализ качества производственных данных', 'Data Science', ['Python', 'SQL']],
    ['Сервис бронирования лабораторий', 'Backend', ['Go', 'PostgreSQL']],
    ['Мониторинг энергопотребления', 'IoT', ['Python', 'MQTT']],
    ['Каталог учебных материалов', 'Frontend', ['React', 'REST API']],
    ['Автоматизация проверки API', 'Тестирование', ['Python', 'Docker']],
    ['Рекомендации для цифровой библиотеки', 'Машинное обучение', ['Python', 'ML']],
    ['Панель состояния оборудования', 'Fullstack', ['TypeScript', 'PostgreSQL']],
  ] as const
  // Eight original and competition cases plus forty additional cases and one moderation sample.
  for (let i = 0; cases.length < 45; i++) {
    const company = companies[i % companies.length]
    const template = structuredClone(INITIAL_CASES[i % INITIAL_CASES.length])
    const topic = topics[i % topics.length]
    const revision = Math.floor(i / topics.length) + 1
    const status = i % 9 === 0 ? 'moderation' : i % 11 === 0 ? 'revision' : 'open'
    cases.push({
      ...template,
      id: 'showcase_case_' + i,
      companyId: company.id,
      companyName: company.name,
      companyLogo: company.logo,
      title: topic[0] + (revision > 1 ? ' — этап ' + revision : ''),
      direction: template.direction,
      requiredCompetencies: [...topic[2]],
      recommendedTech: [...topic[2]],
      shortDescription:
        'Спроектируйте и реализуйте решение для компании «' + company.shortName + '».',
      fullDescription:
        '## Задача\n\n' +
        topic[0] +
        '.\n\n## Результат\n\nПрототип, исходный код и инструкция запуска.\n\n## Проверка\n\nДемонстрация решения и рецензия представителя компании.',
      resultRequirements: 'Прототип, исходный код, тесты и инструкция запуска.',
      kind: i % 8 === 0 ? 'hackathon' : i % 8 === 1 ? 'olympiad' : 'case',
      participationFormat: i % 3 === 0 ? 'individual' : 'team',
      teamSize: i % 3 === 0 ? { min: 1, max: 1 } : { min: 2, max: 5 },
      status,
      moderationStatus:
        status === 'moderation' ? 'pending' : status === 'revision' ? 'revision' : 'approved',
      isModerated: status === 'open',
      moderationComment: undefined,
      isConfidential: false,
      publishedAt: '2026-11-' + String(1 + (i % 12)).padStart(2, '0'),
      deadlineDate: '2027-02-' + String(1 + (i % 25)).padStart(2, '0'),
      assignedTeamId: undefined,
      assignedTeamName: undefined,
      assignedStudentId: undefined,
      assignedStudentName: undefined,
      curatorId: undefined,
      acceptedTeamsCount: 0,
      applicationsCount: 0,
      rewardType: 'educational',
      rewardDescription: 'Рецензия компании и сертификат участия.',
      prizePlaces: undefined,
      prizeFund: undefined,
      rewardAmount: undefined,
      paymentStatus: 'not_provided',
    })
  }
  const students = users.filter((user) => user.role === 'student')
  const projects: StudentProject[] = structuredClone(INITIAL_STUDENT_PROJECTS)
  for (let i = 0; projects.length < 15; i++) {
    const owner = students[i % students.length]
    projects.push({
      ...structuredClone(INITIAL_STUDENT_PROJECTS[i % INITIAL_STUDENT_PROJECTS.length]),
      id: 'showcase_project_' + i,
      authorId: owner.id,
      authorName: owner.fullName,
      title:
        [
          'Планировщик учебных задач',
          'База знаний команды',
          'Панель качества данных',
          'Навигатор студенческих событий',
        ][i % 4] +
        ' ' +
        (Math.floor(i / 4) + 1),
      shortDescription:
        'Учебный проект с прототипом, описанием архитектуры и демонстрацией результата.',
      fullDescription:
        'Разработка помогает организовать совместную работу студентов. Реализованы интерфейс, хранение данных и проверка ввода.',
      githubUrl: '',
      productUrl: '',
      coverImage: '/demo/project.svg',
      screenshots: ['/demo/pytest-preview.svg'],
      visibility: 'public',
      isModerated: i % 5 !== 0,
      moderationStatus: i % 5 === 0 ? 'pending' : 'approved',
      likesCount: i * 3,
      teamName: undefined,
    })
  }
  const comments: ProjectComment[] = structuredClone(INITIAL_COMMENTS)
  for (let i = 0; i < 36; i++) {
    const owner = students[i % students.length]
    const project = i < 12 ? INITIAL_CASES[0] : cases[i % cases.length]
    comments.push({
      id: 'showcase_comment_' + i,
      caseId: project.id,
      authorId: owner.id,
      authorName: owner.fullName,
      authorRole: 'student',
      content: [
        'Подготовил сценарии проверки. Можно обсудить их с наставником?',
        'В прототип добавлены фильтры и обработка пустых данных.',
        'Предлагаю показать промежуточный результат на следующей встрече.',
      ][i % 3],
      createdAt: '2026-11-12T' + String(9 + (i % 10)).padStart(2, '0') + ':00:00Z',
      likesCount: i % 4,
    })
  }
  const audit: AuditLog[] = structuredClone(INITIAL_AUDIT_LOGS)
  for (let i = 0; i < 36; i++) {
    const project = cases[i % cases.length]
    audit.push({
      id: 'showcase_audit_' + i,
      userId: 'usr_admin_1',
      userName: 'Администратор',
      userRole: 'admin',
      timestamp: '2026-11-12T' + String(8 + (i % 12)).padStart(2, '0') + ':00:00Z',
      actionType: 'moderation_action',
      objectType: 'CaseProject',
      objectId: project.id,
      objectName: project.title,
      details: 'Проверены условия и требования публикации.',
    })
  }
  const milestones: ProjectMilestone[] = structuredClone(INITIAL_MILESTONES)
  cases
    .filter((project) => project.id.startsWith('showcase_'))
    .forEach((project) => {
      ;['Разбор задачи', 'Рабочий прототип', 'Демонстрация'].forEach((title, index) => {
        milestones.push({
          id: project.id + '_stage_' + index,
          caseId: project.id,
          title,
          stepNumber: index + 1,
          description: [
            'Сценарии и критерии готовности.',
            'Реализация и тесты.',
            'Демонстрация решения компании.',
          ][index],
          deadline: '2027-01-' + String(10 + index * 5).padStart(2, '0'),
          status: 'pending',
          attachedMaterials: [],
        })
      })
    })
  return { users, companies, cases, projects, comments, audit, milestones }
}
