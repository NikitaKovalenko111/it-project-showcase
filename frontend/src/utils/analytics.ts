import type { CaseApplication, CaseProject, Company, ProjectEvaluation, ProjectMilestone, ProjectTeam, StudentProject, User } from '../types/models'
import { visibleCasesFor } from './access'
import { caseStatusLabels, isPublished, publicationLabels, publicationStatus } from './publication'

export interface AnalyticsFilters {
  period: string
  company: string
  direction: string
  institute: string
  course: string
  type: 'all' | 'company' | 'student'
}
export interface ReportTable { title: string; headers: string[]; rows: (string | number)[][] }
export interface AnalyticsData {
  user: User | null
  cases: CaseProject[]
  projects: StudentProject[]
  companies: Company[]
  students: User[]
  applications: CaseApplication[]
  teams: ProjectTeam[]
  milestones: ProjectMilestone[]
  evaluations: ProjectEvaluation[]
}
export const participantsFor = (project: CaseProject, teams: ProjectTeam[], applications: CaseApplication[]) => {
  const ids = new Set<string>()
  if (project.assignedStudentId) ids.add(project.assignedStudentId)
  teams.filter((team) => team.id === project.assignedTeamId || team.caseId === project.id
    || applications.some((app) => app.caseId === project.id && app.status === 'accepted' && app.teamId === team.id))
    .forEach((team) => { ids.add(team.leaderId); team.members.forEach((member) => ids.add(member.id)) })
  applications.filter((app) => app.caseId === project.id && app.status === 'accepted').forEach((app) => ids.add(app.studentId))
  return [...ids]
}

export const buildAnalyticsReport = (data: AnalyticsData, filters: AnalyticsFilters, today = new Date().toISOString().slice(0, 10)) => {
  const companyView = data.user?.role === 'company'
  const inPeriod = (date: string) => filters.period === 'all' || (date >= `${filters.period}-09-01` && date < `${Number(filters.period) + 1}-09-01`)
  const students = data.students.filter((student) => (filters.institute === 'all' || student.studentProfile?.institute === filters.institute)
    && (filters.course === 'all' || String(student.studentProfile?.course) === filters.course))
  const studentIds = new Set(students.map((student) => student.id))
  const demographicFilter = filters.course !== 'all' || filters.institute !== 'all'
  const cases = filters.type === 'student' ? [] : visibleCasesFor(data.user, data.cases).filter((project) => inPeriod(project.publishedAt)
    && (filters.company === 'all' || project.companyId === filters.company)
    && (filters.direction === 'all' || project.direction === filters.direction)
    && (!demographicFilter || participantsFor(project, data.teams, data.applications).some((id) => studentIds.has(id))
      || data.applications.some((app) => app.caseId === project.id && studentIds.has(app.studentId))))
  const caseIds = new Set(cases.map((project) => project.id))
  const applications = data.applications.filter((app) => caseIds.has(app.caseId) && (!demographicFilter || studentIds.has(app.studentId)))
  const projects = companyView || filters.type === 'company' || filters.company !== 'all' ? [] : data.projects.filter((project) => inPeriod(project.createdAt)
    && (filters.direction === 'all' || project.direction === filters.direction) && (!demographicFilter || studentIds.has(project.authorId)))
  const participantIds = (project: CaseProject) => participantsFor(project, data.teams, applications).filter((id) => !demographicFilter || studentIds.has(id))
  const uniqueParticipants = (items: CaseProject[]) => new Set(items.flatMap(participantIds)).size
  const published = cases.filter(isPublished)
  const completed = published.filter((project) => project.status === 'completed')
  const active = published.filter((project) => ['in_progress', 'submitted', 'review', 'revision', 'accepted'].includes(project.status))
  const overdue = active.filter((project) => project.deadlineDate < today)
  const milestones = data.milestones.filter((item) => caseIds.has(item.caseId))
  const evaluations = data.evaluations.filter((item) => completed.some((project) => project.id === item.caseId))
  const companies = data.companies.filter((company) => (companyView ? company.id === data.user?.companyProfile?.companyId : filters.company === 'all' || company.id === filters.company))
  const prizeFund = published.filter((project) => project.rewardType === 'contest').reduce((sum, project) => sum + (project.prizeFund || 0), 0)
  const monetaryFund = published.filter((project) => project.rewardType === 'monetary').reduce((sum, project) => sum + (project.rewardAmount || 0), 0)
  const pending = [...cases, ...projects].filter((project) => publicationStatus(project) === 'pending').length
  const summary: ReportTable = { title: 'Сводка', headers: ['Показатель', 'Значение'], rows: [
    ['Опубликовано кейсов', published.length], ['Открыт набор', published.filter((project) => project.status === 'open').length],
    ['Кейсов в работе', active.length], ['Завершено кейсов', completed.length], ['Просрочено проектов', overdue.length],
    ['На рассмотрении публикаций', pending], ['Студенческих проектов опубликовано', projects.filter(isPublished).length],
    ['Заявок', applications.length], ['Принято заявок', applications.filter((app) => app.status === 'accepted').length],
    ['Назначено интервью (текущий статус)', applications.filter((app) => app.status === 'interview').length],
    ['Отклонено заявок', applications.filter((app) => app.status === 'rejected').length],
    ['Уникальных участников кейсов', uniqueParticipants(published)], ['Завершили хотя бы один кейс', uniqueParticipants(completed)],
    ['Победителей (участников команд)', uniqueParticipants(completed.filter((project) => evaluations.some((item) => item.caseId === project.id && item.winnerPlace === 1)))],
    ['Участников с подтвержденной выплатой', uniqueParticipants(completed.filter((project) => project.paymentStatus === 'paid'))],
    ['Средняя итоговая оценка', evaluations.length ? `${(evaluations.reduce((sum, item) => sum + item.totalScore, 0) / evaluations.length).toFixed(1)} / 100` : 'Нет оценок'],
    ['Просрочено контрольных точек', milestones.filter((item) => item.status !== 'accepted' && item.deadline < today).length],
    ['Заявленный призовой фонд, ₽', prizeFund], ['Заявленные вознаграждения, ₽', monetaryFund],
    ['Образовательных кейсов', published.filter((project) => project.rewardType === 'educational').length],
    ['Конкурсных кейсов', published.filter((project) => project.rewardType === 'contest').length],
    ['Кейсов с денежным вознаграждением', published.filter((project) => project.rewardType === 'monetary').length],
    ['Кейсов в архиве', published.filter((project) => project.status === 'archived').length],
    ['Отменено кейсов', 'Нет отдельного статуса отмены'],
    ['Приглашения на стажировку', 'Нет данных об истории приглашений'],
  ] }
  if (!companyView) summary.rows.unshift(['Зарегистрировано студентов (фильтр курса/института)', students.length],
    ['Активных студентов (участники кейсов / авторы проектов)', new Set([...published.flatMap(participantIds), ...projects.filter(isPublished).map((project) => project.authorId)]).size],
    ['Компаний в выбранной области', companies.length], ['Активных компаний', new Set(published.filter((project) => !['completed', 'archived'].includes(project.status)).map((project) => project.companyId)).size])
  const caseTable: ReportTable = { title: 'Кейсы', headers: ['Кейс', 'Компания', 'Направление', 'Статус', 'Команда / исполнитель', 'Срок', 'Заявок', 'Участников', 'Оценка / 100', 'Призовой фонд, ₽', 'Вознаграждение, ₽'], rows: cases.map((project) => [
    project.title, project.companyName, project.direction, isPublished(project) ? caseStatusLabels[project.status] : publicationLabels[publicationStatus(project)],
    project.assignedTeamName || project.assignedStudentName || 'Не назначены', project.deadlineDate,
    applications.filter((app) => app.caseId === project.id).length, participantIds(project).length,
    evaluations.find((item) => item.caseId === project.id)?.totalScore ?? 'Нет оценки',
    project.rewardType === 'contest' ? project.prizeFund || 0 : 0, project.rewardType === 'monetary' ? project.rewardAmount || 0 : 0,
  ]) }
  const companyTable: ReportTable = { title: 'Компании', headers: ['Компания', 'Кейсов', 'В работе', 'Завершено', 'Уникальных участников'], rows: companies.map((company) => {
    const companyCases = published.filter((project) => project.companyId === company.id)
    return [company.name, companyCases.length, active.filter((project) => project.companyId === company.id).length, completed.filter((project) => project.companyId === company.id).length, uniqueParticipants(companyCases)]
  }) }
  const directions = [...new Set([...published.map((project) => project.direction), ...projects.filter(isPublished).map((project) => project.direction)])]
  const directionTable: ReportTable = { title: 'Направления', headers: ['Направление', 'Кейсов', 'Студенческих проектов', 'Заявок'], rows: directions.map((direction) => [direction,
    published.filter((project) => project.direction === direction).length, projects.filter((project) => isPublished(project) && project.direction === direction).length,
    applications.filter((app) => cases.some((project) => project.id === app.caseId && project.direction === direction)).length,
  ]) }
  const technologyCounts = new Map<string, number>()
  ;[...published.map((project) => project.recommendedTech), ...projects.filter(isPublished).map((project) => project.technologies)].forEach((technologies) => new Set(technologies).forEach((technology) => technologyCounts.set(technology, (technologyCounts.get(technology) || 0) + 1)))
  const technologyTable: ReportTable = { title: 'Технологии', headers: ['Технология', 'Проектов'], rows: [...technologyCounts].sort((a, b) => b[1] - a[1]) }
  const milestoneTable: ReportTable = { title: 'Контрольные точки', headers: ['Кейс', 'Этап', 'Срок', 'Статус', 'Просрочен'], rows: milestones.map((item) => [
    cases.find((project) => project.id === item.caseId)?.title || item.caseId, item.title, item.deadline,
    ({ pending: 'Ожидает начала', in_progress: 'В работе', submitted: 'На проверке', accepted: 'Принят', needs_work: 'На доработке' })[item.status], item.status !== 'accepted' && item.deadline < today ? 'Да' : 'Нет',
  ]) }
  const projectTable: ReportTable = { title: 'Студенческие проекты', headers: ['Проект', 'Автор', 'Направление', 'Категория', 'Публикация', 'Дата'], rows: projects.map((project) => [project.title, project.authorName, project.direction, project.category, publicationLabels[publicationStatus(project)], project.createdAt]) }
  const applicationTable: ReportTable = { title: 'Заявки', headers: ['Кейс', 'Кандидат / команда', 'Статус', 'Дата'], rows: applications.map((app) => [app.caseTitle, app.teamName || app.studentName,
    ({ pending: 'На рассмотрении', interview: 'Назначено интервью', accepted: 'Принят', rejected: 'Отклонен', need_info: 'Нужны уточнения' })[app.status], app.createdAt.slice(0, 10)]) }
  return { tables: [summary, caseTable, applicationTable, companyTable, directionTable, technologyTable, milestoneTable, ...(!companyView ? [projectTable] : [])],
    metrics: { published: published.length, completed: completed.length, overdue: overdue.length, pending, participants: uniqueParticipants(published), applications: applications.length, interviews: applications.filter((app) => app.status === 'interview').length }, cases }
}

// Spreadsheet-safe fields and BOM preserve literal text and Cyrillic in Excel.
export const csvCell = (value: string | number) => {
  const text = String(value)
  const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
export const reportToCsv = (tables: ReportTable[]) => '\uFEFF' + tables.map((table) => [
  csvCell(table.title), table.headers.map(csvCell).join(';'), ...table.rows.map((row) => row.map(csvCell).join(';')),
].join('\r\n')).join('\r\n\r\n')
