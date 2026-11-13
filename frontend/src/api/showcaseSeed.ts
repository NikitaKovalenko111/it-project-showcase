import type { AuditLog, ProjectComment, User } from '../types/models'
import { INITIAL_USERS, INITIAL_COMMENTS, INITIAL_AUDIT_LOGS } from './mockData'
import {
  buildStudents,
  buildCompanies,
  buildCases,
  buildPortfolio,
  buildMilestones,
} from './fixtures/builders'

export function showcaseSeed() {
  const companies = buildCompanies()
  const cases = buildCases()
  const projects = buildPortfolio()
  const students = buildStudents()
  const representatives = [
    'Ирина Котова',
    'Денис Хакимов',
    'Светлана Юдина',
    'Вадим Рябов',
    'Оксана Лукина',
  ]
  const users: User[] = [
    ...students,
    ...structuredClone(INITIAL_USERS.filter((user) => user.role !== 'student')),
    ...representatives.map(
      (fullName, index): User => ({
        id: 'showcase_representative_' + index,
        username: 'coordinator_' + (index + 1),
        fullName,
        email: 'coordinator@company-' + (index + 2) + '.example',
        role: 'company',
        createdAt: '2026-09-01T09:00:00Z',
        companyProfile: {
          companyId: companies[index + 1].id,
          companyName: companies[index + 1].name,
          position: 'Координатор проектов',
        },
      }),
    ),
    {
      id: 'showcase_curator',
      username: 'curator_2',
      fullName: 'Ольга Сергеева',
      email: 'sergeeva@university.example',
      role: 'curator',
      createdAt: '2026-09-01T09:00:00Z',
    },
  ]
  const comments: ProjectComment[] = structuredClone(INITIAL_COMMENTS)
  // Only participants and organisers discuss the current work; comments reference its requirements.
  for (let index = 0; index < 36; index++) {
    const project = cases[1 + (index % (cases.length - 6))]
    const author =
      index % 2
        ? users.find((user) => user.id === 'usr_curator_1')!
        : students[(index + 1) % students.length]
    comments.push({
      id: 'showcase_comment_' + index,
      caseId: project.id,
      authorId: author.id,
      authorName: author.fullName,
      authorRole: author.role,
      content:
        index % 2
          ? 'Для задания «' +
            project.title +
            '» согласуйте критерии приёмки до разработки. Проверьте, что инструкция позволяет повторить основной сценарий.'
          : 'Изучил требования по теме «' +
            project.title +
            '». Можно ли на первой встрече уточнить формат входных данных и ограничения учебного стенда?',
      createdAt: '2026-11-' + String(9 + (index % 4)).padStart(2, '0') + 'T10:00:00Z',
      likesCount: index % 3,
    })
  }
  const audit: AuditLog[] = structuredClone(INITIAL_AUDIT_LOGS)
  for (const [index, project] of cases.filter((item) => item.isModerated).entries()) {
    audit.push({
      id: 'showcase_audit_' + index,
      userId: 'usr_admin_1',
      userName: 'Наиль Хисамов',
      userRole: 'admin',
      timestamp: '2026-11-10T09:00:00Z',
      actionType: 'moderation_action',
      objectType: 'CaseProject',
      objectId: project.id,
      objectName: project.title,
      details:
        'Проверены описание задачи, требования к результату и условия участия. Публикация одобрена.',
    })
  }
  companies.forEach((company) => {
    company.activeCasesCount = cases.filter(
      (project) => project.companyId === company.id && project.isModerated,
    ).length
  })
  return { users, companies, cases, projects, comments, audit, milestones: buildMilestones(cases) }
}
