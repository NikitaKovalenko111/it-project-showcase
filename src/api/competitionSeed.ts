import { INITIAL_CASES, INITIAL_USERS } from './mockData'
import { CaseProject, User, CaseApplication } from '../types/models'
import { Execution } from '../types/execution'
export function competitionSeed() {
  const cases: CaseProject[] = ['case', 'hackathon', 'olympiad'].map((kind, i) => ({
    ...structuredClone(INITIAL_CASES[0]),
    id: `demo_${kind}`,
    kind: kind as CaseProject['kind'],
    ...(kind === 'olympiad' ? { direction: 'Программирование' as const, recommendedTech: [] } : {}),
    title: [
      'Промышленный сервис мониторинга',
      'Хакатон «Умный кампус»',
      'Олимпиада по программированию',
    ][i],
    shortDescription: [
      'Разработайте сервис для сбора и анализа телеметрии оборудования.',
      'Предложите цифровое решение для студентов и сотрудников кампуса.',
      'Решите задачи на последовательности и графы.',
    ][i],
    fullDescription: [
      'Подготовьте прототип сервиса, который собирает показания датчиков и выявляет отклонения.',
      'Выберите задачу кампуса, соберите прототип и покажите его на защите.',
      'Сдайте решения задач с пояснением алгоритмов и оценкой сложности.',
    ][i],
    resultRequirements: [
      'Рабочий сервис, исходный код и инструкция запуска.',
      'Прототип сервиса для кампуса, презентация и демонстрация.',
      'Решения задач, исходный код и пояснения алгоритмов.',
    ][i],
    prizePlaces: undefined,
    prizeFund: undefined,
    rewardAmount: undefined,
    rewardType: 'educational',
    rewardDescription: [
      'Опыт разработки промышленного сервиса и рецензия компании.',
      'Практика командной разработки и обратная связь жюри.',
      'Сертификат участника и разбор решений.',
    ][i],
    status: 'in_progress',
    moderationStatus: 'approved',
    isModerated: true,
    isConfidential: false,
    assignedTeamId: undefined,
    assignedStudentId: undefined,
    assignedTeamName: undefined,
    assignedStudentName: undefined,
    participationFormat: kind === 'olympiad' ? 'individual' : 'team',
    teamSize: kind === 'olympiad' ? { min: 1, max: 1 } : { min: 1, max: 5 },
    deadlineDate: '2027-06-30',
    acceptedTeamsCount: 12,
    maxTeams: 50,
    applicationsCount: 12,
    publishedAt: '2026-11-02',
    evaluationCriteria:
      kind === 'olympiad'
        ? []
        : [
            { id: 'quality', label: 'Качество решения', weight: 1 },
            { id: 'architecture', label: 'Архитектура', weight: 1 },
          ],
    olympiadTasks:
      kind === 'olympiad'
        ? [
            { id: 'a', title: 'Задача A · последовательности', maxScore: 30 },
            { id: 'b', title: 'Задача B · графы', maxScore: 70 },
          ]
        : undefined,
  }))
  const users: User[] = Array.from({ length: 12 }, (_, i) => ({
    ...structuredClone(INITIAL_USERS[0]),
    id: `demo_student_${i}`,
    username: `demo_student_${i}`,
    fullName: [
      'Анна Волкова',
      'Максим Орлов',
      'Дарья Соколова',
      'Роман Козлов',
      'Екатерина Морозова',
      'Никита Фёдоров',
      'Алина Смирнова',
      'Михаил Егоров',
      'Полина Сидорова',
      'Илья Новиков',
      'София Попова',
      'Артём Павлов',
    ][i],
    email: `demo${i}@example.test`,
    avatar: undefined,
    phone: undefined,
    studentProfile: {
      ...structuredClone(INITIAL_USERS[0].studentProfile!),
      curatorId: undefined,
      course: 2 + (i % 3),
      group: ['ПИ-204', 'ПМИ-301', 'ИВТ-402'][i % 3],
      bio: '',
      githubUrl: '',
      portfolioUrl: '',
      phone: '',
      skills: [
        ['Python', 'STM32'],
        ['React', 'TypeScript'],
        ['Go', 'SQL'],
      ][i % 3],
      techStack: [
        ['Python', 'STM32'],
        ['React', 'TypeScript'],
        ['Go', 'SQL'],
      ][i % 3],
      rating: 60 + i * 3,
      verifiedProjectsCount: 0,
      winsCount: 0,
    },
  }))
  const executions: Execution[] = cases.flatMap((c) =>
    Array.from({ length: 12 }, (_, i) => {
      const user = i === 0 ? INITIAL_USERS[0] : users[i]
      const scores =
        c.kind === 'olympiad'
          ? { a: 20 + (i % 10), b: 40 + (i % 20) }
          : { quality: 5 + (i % 6), architecture: 6 + (i % 5) }
      return {
        id: `${c.id}_execution_${i}`,
        caseId: c.id,
        teamId: c.kind === 'olympiad' ? undefined : `${c.id}_team_${i}`,
        studentId: user.id,
        name:
          c.kind === 'olympiad'
            ? user.fullName
            : `${c.kind === 'hackathon' ? 'Кампус' : 'Индустрия'} ${i + 1} · ${['Код', 'Вектор', 'Импульс'][i % 3]}`,
        members: [
          {
            id: user.id,
            name: user.fullName,
            role: c.kind === 'olympiad' ? 'Участник' : 'Капитан',
            competencies: ['TypeScript'],
            ...(user.avatar ? { avatar: user.avatar } : {}),
          },
        ],
        status: i < 4 ? 'evaluated' : i < 9 ? 'submitted' : 'active',
        submission:
          i < 9
            ? {
                id: `${c.id}_sub_${i}`,
                caseId: c.id,
                studentId: user.id,
                authorName: user.fullName,
                description: `Решение участника ${i + 1}. Реализованы основные требования, приложены материалы для проверки.`,
                repoUrl: '',
                screenshots: [],
                attachedFiles: [
                  { name: 'Решение.txt', url: 'data:text/plain;charset=utf-8,Demo%20solution' },
                ],
                submittedAt: '2026-11-02T10:00:00Z',
              }
            : undefined,
        evaluation:
          i < 4
            ? {
                id: `${c.id}_eval_${i}`,
                caseId: c.id,
                companyId: c.companyId,
                companyName: c.companyName,
                evaluatorName: 'Демо жюри',
                scores,
                totalScore: Object.values(scores).reduce((a, b) => a + b, 0),
                maxScore: c.kind === 'olympiad' ? 100 : 20,
                feedback: 'Демонстрационная оценка',
                evaluatedAt: '2026-11-02T11:00:00Z',
              }
            : undefined,
      } as Execution
    }),
  )
  const teams = executions
    .filter((e) => e.teamId)
    .map((e) => ({
      id: e.teamId!,
      caseId: e.caseId,
      name: e.name,
      leaderId: e.members[0].id,
      leaderName: e.members[0].name,
      members: e.members,
      createdAt: '2026-11-02',
    }))
  const applications: CaseApplication[] = executions.map((e) => {
    const c = cases.find((c) => c.id === e.caseId)!,
      u = [...INITIAL_USERS, ...users].find((u) => u.id === e.studentId)!
    return {
      id: `app_${e.id}`,
      caseId: e.caseId,
      caseTitle: c.title,
      companyId: c.companyId,
      applicantType: e.teamId ? 'team' : 'individual',
      studentId: u.id,
      studentName: u.fullName,
      studentEmail: u.email,
      studentPhone: u.phone || '',
      studentCourse: u.studentProfile?.course || 1,
      studentInstitute: u.studentProfile?.institute || '',
      teamId: e.teamId,
      teamName: e.teamId ? e.name : undefined,
      coverLetter: 'Демонстрационная регистрация',
      resumeUrl: '',
      portfolioUrl: '',
      githubUrl: '',
      previousProjects: [],
      status: 'accepted',
      createdAt: '2026-11-02T09:00:00Z',
    }
  })
  executions.forEach((e) => {
    e.applicationId = `app_${e.id}`
  })
  const pendingStudent = users[0],
    pendingCase = cases[0]
  applications.push({
    ...applications[0],
    id: 'demo_pending_application',
    caseId: pendingCase.id,
    studentId: pendingStudent.id,
    studentName: pendingStudent.fullName,
    studentEmail: pendingStudent.email,
    teamId: undefined,
    teamName: undefined,
    applicantType: 'individual',
    status: 'pending',
    coverLetter: 'Хочу участвовать в проекте. Готов обсудить задачи на интервью.',
  })
  return { cases, users, executions, teams, applications }
}
