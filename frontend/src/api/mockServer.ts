import { buildCases, buildCompanies, buildPortfolio, buildStudents } from './fixtures/builders'
import { textAttachment } from './fixtures/builders'
import { createId } from '../utils/id'
import { showcaseSeed } from './showcaseSeed'
import { TEAM_NAME_MAX_LENGTH } from '../utils/validation'
import { Execution } from '../types/execution'
import { competitionSeed } from './competitionSeed'
import { openRegistration } from '../utils/competition'
import { legacyCriteria, evaluationTotal } from '../utils/evaluation'
import {
  AuditLog,
  CaseApplication,
  CaseProject,
  Company,
  ProjectComment,
  ProjectEvaluation,
  ProjectMilestone,
  ProjectSubmission,
  ProjectTeam,
  StudentProject,
  SystemNotification,
  User,
  ModerationStatus,
  TeamRequest,
  TeamSeeker,
  ContentReport,
} from '../types/models'
import {
  INITIAL_APPLICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CASES,
  INITIAL_COMMENTS,
  INITIAL_COMPANIES,
  INITIAL_EVALUATIONS,
  INITIAL_MILESTONES,
  INITIAL_NOTIFICATIONS,
  INITIAL_STUDENT_PROJECTS,
  INITIAL_SUBMISSIONS,
  INITIAL_TEAMS,
  INITIAL_USERS,
} from './mockData'
import { canManageCase, participatesInCase, visibleCasesFor } from '../utils/access'
import { canReceiveApplications } from '../utils/recruiting'
import {
  canModerate,
  isPublished,
  publicationLabels,
  matchesSearch,
  visibleStudentProjectsFor,
} from '../utils/publication'

// Keys for localStorage
export const MOCK_STORAGE_PREFIX = 'uust_showcase_curated_v1_'
const STORAGE_PREFIX = MOCK_STORAGE_PREFIX
const load = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(fallback))
      return structuredClone(fallback)
    }
    return JSON.parse(raw) as T
  } catch {
    return structuredClone(fallback)
  }
}

const save = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
  } catch (e) {
    console.error('Storage save error:', e)
  }
}

const showcase = showcaseSeed()

export class MockServer {
  private notifyReviewers(kind: 'case' | 'student', title: string): void {
    this.users.filter(canModerate).forEach((user) =>
      this.notifications.unshift({
        id: `review_${Date.now()}_${kind}_${user.id}`,
        userId: user.id,
        type: 'publication_status',
        title: 'Новая публикация на рассмотрении',
        message: title,
        read: false,
        link: kind === 'case' ? '/companies?review=cases' : '/student-projects?review=student',
        createdAt: new Date().toISOString(),
      }),
    )
    save('notifications', this.notifications)
  }
  private sessionUser(): User | undefined {
    const raw = localStorage.getItem('uust_current_user')
    if (!raw) return undefined
    const stored = JSON.parse(raw) as User
    return this.users.find((u) => u.id === stored.id)
  }

  private requireCaseManager(caseId: string): CaseProject {
    const project = this.cases.find((c) => c.id === caseId)
    if (!project || !canManageCase(this.sessionUser(), project))
      throw new Error('Нет прав на изменение этого кейса')
    return project
  }

  private requireAdmin(): void {
    if (this.sessionUser()?.role !== 'admin')
      throw new Error('Действие доступно только администратору')
  }
  private users: User[] = load('users', showcase.users)
  private companies: Company[] = load('companies', showcase.companies)
  private cases: CaseProject[] = load('cases', showcase.cases)
  private milestones: ProjectMilestone[] = load('milestones', showcase.milestones)
  private submissions: ProjectSubmission[] = load('submissions', INITIAL_SUBMISSIONS)
  private evaluations: ProjectEvaluation[] = load('evaluations', INITIAL_EVALUATIONS)
  private projectLikes: Record<string, string[]> = load('studentProjectLikes', {})
  private studentProjects: StudentProject[] = load('studentProjects', showcase.projects)
  private applications: CaseApplication[] = load('applications', INITIAL_APPLICATIONS)
  private teams: ProjectTeam[] = load('teams', INITIAL_TEAMS)
  private comments: ProjectComment[] = load('comments', showcase.comments)
  private notifications: SystemNotification[] = load('notifications', INITIAL_NOTIFICATIONS)
  private auditLogs: AuditLog[] = load('auditLogs', showcase.audit)
  private favorites: string[] = load('favorites', ['case_1', 'case_2'])
  private ndaAccepted: string[] = load('ndaAccepted', [])
  private teamRequests: TeamRequest[] = load('teamRequests', [])
  private seekers: TeamSeeker[] = load('seekers', [])
  private reports: ContentReport[] = load('reports', [])

  private executions: Execution[] = load('executions', [])
  constructor() {
    const demo = competitionSeed()
    const pendingCase: CaseProject = {
      ...structuredClone(INITIAL_CASES[1]),
      id: 'demo_case_review',
      title: 'Панель доступности городских сервисов',
      companyId: 'comp_1',
      companyName: this.companies[0].name,
      companyLogo: this.companies[0].logo,
      direction: 'Frontend',
      shortDescription:
        'Дежурной команде нужен единый экран состояния сервисов и история недоступности.',
      fullDescription:
        '## Задача\n\nПокажите текущее состояние городских сервисов, историю сбоев и фильтры по типу сервиса.\n\n## Проверка\n\nОбработайте недоступность источника, пустой журнал и восстановление связи.',
      resultRequirements: 'Веб-панель со статусами, журналом сбоев и инструкцией запуска.',
      requiredCompetencies: ['React', 'TypeScript', 'REST API'],
      recommendedTech: ['React', 'TypeScript'],
      status: 'moderation',
      moderationStatus: 'pending',
      isModerated: false,
      applicationsCount: 0,
      publishedAt: '',
    }
    for (const project of [...demo.cases, pendingCase])
      if (!this.cases.some((item) => item.id === project.id)) this.cases.push(project)
    for (const user of demo.users)
      if (!this.users.some((item) => item.id === user.id)) this.users.push(user)
    for (const team of demo.teams)
      if (!this.teams.some((item) => item.id === team.id)) this.teams.push(team)
    for (const application of demo.applications)
      if (!this.applications.some((item) => item.id === application.id))
        this.applications.push(application)
    // Initial examples are added once; later edits remain stored in this dataset's namespace.
    if (!load('competition_initialized', false)) {
      this.executions.push(...demo.executions)
      save('executions', this.executions)
      save('competition_initialized', true)
    }
    if (!load('shared_plan_initialized', false)) {
      for (const project of demo.cases) {
        const descriptions =
          project.kind === 'olympiad'
            ? [
                'Разобрать формат ввода и ограничения задач. Проверить чтение данных на примерах.',
                'Подготовить алгоритмы для последовательностей и графов. Описать сложность.',
                'Проверить граничные случаи и сдать исходный код с пояснениями.',
              ]
            : [
                'Согласовать пользовательский сценарий и входные данные с наставником.',
                project.resultRequirements,
                'Показать основной сценарий, тесты и ограничения. Приложить инструкцию запуска.',
              ]
        descriptions.forEach((description, index) =>
          this.milestones.push({
            id: project.id + '_plan_' + index,
            caseId: project.id,
            stepNumber: index + 1,
            title: ['Разбор задания', 'Реализация', 'Проверка и защита'][index],
            description,
            deadline: ['2027-06-16', '2027-06-23', '2027-06-30'][index],
            status: 'pending',
            attachedMaterials: [],
          }),
        )
      }
      save('milestones', this.milestones)
      save('shared_plan_initialized', true)
    }
    // Upgrade only untouched fixture fields; retain manually edited records and uploaded files.
    if (!load('fixture_quality_20261114', false)) {
      for (const company of this.companies) {
        const fixture = showcase.companies.find((item) => item.id === company.id)
        if (!fixture) continue
        if (!company.website) company.website = fixture.website
        if (!company.internshipProgram) company.internshipProgram = fixture.internshipProgram
        if (!company.practiceProgram) company.practiceProgram = fixture.practiceProgram
        if (company.description === fixture.description.split('\n\n')[0])
          company.description = fixture.description
      }
      for (const fixture of demo.executions) {
        const entry = this.executions.find((item) => item.id === fixture.id)
        const team = this.teams.find((item) => item.id === fixture.teamId)
        if (
          team &&
          team.name === fixture.name &&
          team.members.length === 1 &&
          team.members[0].id === fixture.members[0].id
        ) {
          team.members = [team.members[0], ...fixture.members.slice(1)]
          if (!team.description)
            team.description = demo.teams.find((item) => item.id === team.id)?.description
          if (entry?.members.length === 1)
            entry.members = [entry.members[0], ...fixture.members.slice(1)]
        }
        if (entry?.submission && fixture.submission) {
          const legacy = fixture.submission.description.split('\n\nПодготовка данных:')[0]
          if (entry.submission.description === legacy) {
            entry.submission.description = fixture.submission.description
            if (!entry.submission.screenshots.length)
              entry.submission.screenshots = fixture.submission.screenshots
          }
        }
      }
      save('executions', this.executions)
      save('fixture_quality_20261114', true)
    }
    if (!load('fixture_details_20261114_v2', false)) {
      const legacyCases = buildCases(false),
        legacyCompanies = buildCompanies(false),
        legacyProjects = buildPortfolio(false),
        legacyUsers = buildStudents(false)
      for (const item of this.cases) {
        const old = legacyCases.find((row) => row.id === item.id),
          next = showcase.cases.find((row) => row.id === item.id)
        if (old && next && item.fullDescription === old.fullDescription)
          item.fullDescription = next.fullDescription
      }
      for (const item of this.companies) {
        const old = legacyCompanies.find((row) => row.id === item.id),
          next = showcase.companies.find((row) => row.id === item.id)
        if (old && next && item.description === old.description) item.description = next.description
      }
      for (const item of this.studentProjects) {
        const old = legacyProjects.find((row) => row.id === item.id),
          next = showcase.projects.find((row) => row.id === item.id)
        if (old && next && item.fullDescription === old.fullDescription)
          item.fullDescription = next.fullDescription
      }
      for (const item of this.users) {
        const old = legacyUsers.find((row) => row.id === item.id),
          next = showcase.users.find((row) => row.id === item.id)
        if (
          old &&
          next &&
          item.studentProfile?.bio === old.studentProfile?.bio &&
          item.studentProfile
        )
          item.studentProfile.bio = next.studentProfile!.bio
      }
      save('studentProjects', this.studentProjects)
      save('fixture_details_20261114_v2', true)
    }
    if (!load('fixture_profiles_20261114_v3', false)) {
      const fillBlank = (
        target: Record<string, unknown>,
        fixture: Record<string, unknown>,
        fields: string[],
      ) => {
        for (const field of fields) {
          if (
            target[field] === undefined ||
            target[field] === '' ||
            (Array.isArray(target[field]) && !target[field].length)
          )
            if (fixture[field] !== undefined) target[field] = structuredClone(fixture[field])
        }
      }
      for (const item of this.companies) {
        const fixture = showcase.companies.find((company) => company.id === item.id)
        if (fixture)
          fillBlank(
            item as unknown as Record<string, unknown>,
            fixture as unknown as Record<string, unknown>,
            ['inn', 'kpp', 'ogrn', 'legalAddress', 'phone', 'documents'],
          )
      }
      for (const item of this.users) {
        const fixture = showcase.users.find((user) => user.id === item.id)
        if (fixture?.studentProfile && item.studentProfile)
          fillBlank(
            item.studentProfile as unknown as Record<string, unknown>,
            fixture.studentProfile as unknown as Record<string, unknown>,
            ['phone', 'githubUrl', 'gitlabUrl', 'portfolioUrl', 'links', 'resume', 'files'],
          )
      }
      for (const item of this.studentProjects) {
        const fixture = showcase.projects.find((project) => project.id === item.id)
        if (fixture)
          fillBlank(
            item as unknown as Record<string, unknown>,
            fixture as unknown as Record<string, unknown>,
            ['githubUrl', 'productUrl', 'screenshots'],
          )
      }
      for (const entry of this.executions) {
        const fixture = demo.executions.find((row) => row.id === entry.id)
        if (entry.submission && fixture?.submission)
          fillBlank(
            entry.submission as unknown as Record<string, unknown>,
            fixture.submission as unknown as Record<string, unknown>,
            ['repoUrl', 'demoUrl', 'documentationUrl', 'presentationUrl'],
          )
      }
      save('studentProjects', this.studentProjects)
      save('executions', this.executions)
      save('fixture_profiles_20261114_v3', true)
    }
    if (!load('team_catalog_annotations_v1', false)) {
      const students = buildStudents()
      const definitions = [
        {
          id: 'recruiting_interface',
          name: 'Интерфейсная мастерская',
          leader: 18,
          project: 'case_2',
          description:
            'Разрабатываем календарь лабораторий. Ищем участника, который поможет с доступностью форм, состояниями загрузки и проверкой мобильной версии. Встречаемся по вторникам; перед первой задачей обсуждаем макеты и критерии готовности.',
        },
        {
          id: 'recruiting_data',
          name: 'Исследователи данных',
          leader: 21,
          project: 'case_3',
          description:
            'Сравниваем способы проверки учебных данных. Нужны Python, внимательность к пропускам и желание документировать эксперименты. Начинаем с небольшого набора, результаты обсуждаем с наставником раз в неделю.',
        },
        {
          id: 'recruiting_quality',
          name: 'Качество по шагам',
          leader: 24,
          project: 'case_4',
          description:
            'Готовим прототип и воспроизводимые сценарии проверки. Ищем разработчика интерфейса или тестировщика. Задачи распределяем по доступному времени, код просматриваем вместе и фиксируем личный вклад в отчёте.',
        },
      ]
      for (const item of definitions) {
        const leader = students[item.leader]
        if (!this.teams.some((team) => team.id === item.id))
          this.teams.push({
            id: item.id,
            name: item.name,
            description: item.description,
            leaderId: leader.id,
            leaderName: leader.fullName,
            recruitingCaseId: item.project,
            createdAt: '2026-11-13',
            members: [
              {
                id: leader.id,
                name: leader.fullName,
                role: 'Капитан',
                competencies: leader.studentProfile!.skills,
                email: leader.email,
              },
            ],
          })
      }
      const requests: TeamRequest[] = [
        {
          id: 'seed_incoming_invitation',
          teamId: 'recruiting_interface',
          studentId: students[0].id,
          senderId: students[18].id,
          kind: 'invitation',
          message:
            'Приглашаем помочь с интерфейсом календаря и проверкой доступности. Можно начать с одного сценария записи в лабораторию.',
          status: 'pending',
          createdAt: '2026-11-13T10:00:00Z',
        },
        {
          id: 'seed_incoming_application',
          teamId: 'team_alpha',
          studentId: students[19].id,
          senderId: students[19].id,
          kind: 'application',
          message:
            'Хочу присоединиться к проверке телеметрии. Могу подготовить набор граничных случаев и инструкцию воспроизведения.',
          status: 'pending',
          createdAt: '2026-11-13T11:00:00Z',
        },
        {
          id: 'seed_outgoing_invitation',
          teamId: 'team_alpha',
          studentId: students[20].id,
          senderId: students[0].id,
          kind: 'invitation',
          message:
            'Предлагаем взять визуализацию истории показаний. Требования и учебный набор разберём на первой встрече.',
          status: 'pending',
          createdAt: '2026-11-13T12:00:00Z',
        },
        {
          id: 'seed_outgoing_application',
          teamId: 'recruiting_data',
          studentId: students[0].id,
          senderId: students[0].id,
          kind: 'application',
          message:
            'Готов помочь с панелью сравнения экспериментов и формами загрузки данных. Удобен дистанционный формат.',
          status: 'pending',
          createdAt: '2026-11-13T13:00:00Z',
        },
      ]
      for (const request of requests)
        if (!this.teamRequests.some((row) => row.id === request.id)) this.teamRequests.push(request)
      for (const index of [19, 20, 22]) {
        const student = students[index]
        if (!this.seekers.some((row) => row.studentId === student.id))
          this.seekers.push({
            id: 'seed_seeker_' + index,
            studentId: student.id,
            message:
              'Ищу команду для учебного прототипа. Готов обсуждать требования, брать небольшие задачи и показывать результат раз в неделю.',
            techStack: student.studentProfile!.skills,
          })
      }
      save('teamRequests', this.teamRequests)
      save('seekers', this.seekers)
      save('team_catalog_annotations_v1', true)
    }
    if (!load('fixture_legal_repair_v4', false)) {
      for (const item of this.companies) {
        const fixture = showcase.companies.find((row) => row.id === item.id)
        if (!fixture) continue
        for (const key of ['inn', 'kpp', 'ogrn', 'legalAddress', 'phone'] as const)
          if (!item[key]?.trim()) item[key] = fixture[key]
        if (!item.documents?.length) item.documents = structuredClone(fixture.documents || [])
      }
      save('fixture_legal_repair_v4', true)
    }
    this.cases.forEach((project) => {
      const apps = this.applications.filter((item) => item.caseId === project.id)
      project.applicationsCount = apps.length
      project.acceptedTeamsCount = apps.filter(
        (item) => item.teamId && item.status === 'accepted',
      ).length
    })
    this.companies.forEach((company) => {
      company.activeCasesCount = this.cases.filter(
        (project) =>
          project.companyId === company.id &&
          project.isModerated &&
          !['completed', 'archived'].includes(project.status),
      ).length
      company.completedProjectsCount = this.cases.filter(
        (project) =>
          project.companyId === company.id && ['completed', 'archived'].includes(project.status),
      ).length
    })
    save('cases', this.cases)
    save('users', this.users)
    save('teams', this.teams)
    save('applications', this.applications)
    save('companies', this.companies)
  }
  withdrawCaseModeration(id: string): CaseProject {
    const project = this.requireCaseManager(id)
    if (this.sessionUser()?.role !== 'company' || project.status !== 'moderation')
      throw new Error('Отозвать можно только свою публикацию на модерации.')
    project.status = 'revision'
    project.moderationStatus = 'revision'
    project.moderationComment = 'Публикация отозвана компанией для редактирования.'
    project.isModerated = false
    save('cases', this.cases)
    return structuredClone(project)
  }
  private syncExecutions(caseId: string): void {
    const project = this.cases.find((c) => c.id === caseId)
    if (!project) return
    const apps = this.applications.filter((a) => a.caseId === caseId && a.status === 'accepted')
    for (const app of apps) {
      if (
        this.executions.some(
          (e) =>
            e.caseId === caseId &&
            (app.teamId ? e.teamId === app.teamId : e.studentId === app.studentId),
        )
      )
        continue
      const team = this.teams.find((t) => t.id === app.teamId)
      this.executions.push({
        id: `execution_${app.id}`,
        caseId,
        applicationId: app.id,
        teamId: app.teamId,
        studentId: app.studentId,
        name: app.teamName || app.studentName,
        submission:
          (project.assignedTeamId === app.teamId && !!app.teamId) ||
          project.assignedStudentId === app.studentId
            ? this.submissions.find((s) => s.caseId === caseId)
            : undefined,
        evaluation:
          (project.assignedTeamId === app.teamId && !!app.teamId) ||
          project.assignedStudentId === app.studentId
            ? this.evaluations.find((e) => e.caseId === caseId)
            : undefined,
        members: team?.members || [
          {
            id: app.studentId,
            name: app.studentName,
            role: 'Участник',
            competencies: [],
            avatar: app.studentAvatar,
          },
        ],
        status: 'active',
      })
    }
    if (
      !this.executions.some((e) => e.caseId === caseId) &&
      (project.assignedTeamId || project.assignedStudentId)
    ) {
      const team = this.teams.find((t) => t.id === project.assignedTeamId)
      const sub = this.submissions.find((s) => s.caseId === caseId),
        evaluation = this.evaluations.find((e) => e.caseId === caseId)
      this.executions.push({
        id: `execution_legacy_${caseId}`,
        caseId,
        teamId: team?.id,
        studentId: project.assignedStudentId,
        name: team?.name || project.assignedStudentName || 'Участник',
        members: team?.members || [
          {
            id: project.assignedStudentId!,
            name: project.assignedStudentName || 'Участник',
            role: 'Участник',
            competencies: [],
          },
        ],
        status: evaluation ? 'evaluated' : sub ? 'submitted' : 'active',
        submission: sub,
        evaluation,
      })
    }
    this.executions
      .filter((e) => e.caseId === caseId)
      .forEach((e) => {
        e.status = e.evaluation ? 'evaluated' : e.submission ? 'submitted' : 'active'
        if (e.teamId) {
          const team = this.teams.find((t) => t.id === e.teamId)
          if (team) e.members = structuredClone(team.members)
        }
        e.milestones ||= []
        const upgradedStages = load<string[]>('fixture_work_details_v3', [])
        const upgradeStages =
          e.id.startsWith('demo_') && project.kind !== 'olympiad' && !upgradedStages.includes(e.id)

        for (const template of this.milestones.filter((m) => m.caseId === caseId)) {
          const id = `${e.id}::${template.id}`
          const existing = e.milestones.find((m) => m.id === id)
          if (!existing) {
            const legacy =
              (project.assignedTeamId && project.assignedTeamId === e.teamId) ||
              (!e.teamId && project.assignedStudentId === e.studentId)
            e.milestones.push(
              legacy
                ? { ...structuredClone(template), id }
                : {
                    id,
                    caseId,
                    stepNumber: template.stepNumber,
                    title: template.title,
                    description: template.description,
                    deadline: template.deadline,
                    status:
                      e.id.startsWith('demo_') && project.kind !== 'olympiad' && e.submission
                        ? 'accepted'
                        : 'pending',
                    attachedMaterials: [],
                  },
            )
          } else {
            existing.title = template.title
            existing.description = template.description
            existing.deadline = template.deadline
            existing.stepNumber = template.stepNumber
          }
        }
        if (upgradeStages) {
          const index = Number(e.id.split('_').slice(-1)[0])
          for (const stage of e.milestones) {
            const previousDefault = e.submission ? 'accepted' : 'pending'
            if (
              stage.status !== previousDefault ||
              stage.attachedMaterials.length ||
              stage.feedback
            )
              continue
            const step = stage.stepNumber - 1
            const progress =
              index < 4
                ? ['accepted', 'accepted', 'accepted']
                : index < 9
                  ? [
                      'accepted',
                      index % 2 ? 'accepted' : 'needs_work',
                      index % 2 ? 'submitted' : 'pending',
                    ]
                  : ['in_progress', 'pending', 'pending']
            stage.status = (progress[step] as ProjectMilestone['status']) || 'pending'
            if (['accepted', 'submitted', 'needs_work'].includes(stage.status)) {
              stage.attachedMaterials = [
                textAttachment(
                  ['Сценарии и требования.txt', 'Проверка прототипа.txt', 'Отчёт о защите.txt'][
                    step
                  ] || 'Отчёт.txt',
                  e.name +
                    ' · ' +
                    project.title +
                    '\n\n' +
                    stage.description +
                    '\n\nЛичный вклад: ' +
                    e.members.map((member) => member.name + ' - ' + member.role).join('; ') +
                    '\n\nПроверки: корректный ввод, пустые значения, повторное действие, восстановление после ошибки. Результаты проверяем по согласованным критериям задания.',
                ),
              ]
              stage.submittedAt = '2026-11-11T10:00:00Z'
              stage.feedback =
                stage.status === 'accepted'
                  ? 'Материалы проверены. Основной сценарий воспроизводится по инструкции.'
                  : stage.status === 'needs_work'
                    ? 'Добавьте результаты проверки восстановления после ошибки и укажите ограничения прототипа.'
                    : undefined
            }
          }
          upgradedStages.push(e.id)
          save('fixture_work_details_v3', upgradedStages)
        }
        e.milestones.sort((a, b) => a.stepNumber - b.stepNumber)
      })
    save('executions', this.executions)
  }
  updateExecutionStage(
    executionId: string,
    stageId: string,
    action: 'submit' | 'accepted' | 'needs_work' | 'remove',
    files: { name: string; url: string }[] = [],
    feedback = '',
    fileIndex?: number,
  ): Execution {
    const entry = this.executions.find((e) => e.id === executionId),
      user = this.actor()
    if (!entry) throw new Error('Выполнение не найдено')
    const project = this.cases.find((c) => c.id === entry.caseId)!
    if (project.status === 'completed') throw new Error('Проект завершён')
    const stage = entry.milestones?.find((m) => m.id === stageId)
    if (!stage) throw new Error('Этап не найден')
    if (action === 'submit' || action === 'remove') {
      if (user.role !== 'student' || !entry.members.some((m) => m.id === user.id))
        throw new Error('Материалы доступны только участникам этого выполнения')
      if (entry.evaluation) throw new Error('Итоговая работа оценена, материалы зафиксированы')
      if (stage.status === 'accepted') throw new Error('Принятый этап нельзя изменять')
      if (action === 'remove') {
        stage.attachedMaterials = stage.attachedMaterials.filter((_, i) => i !== fileIndex)
        if (!stage.attachedMaterials.length) {
          stage.status = 'pending'
          stage.submittedAt = undefined
        }
      } else {
        if (!files.length) throw new Error('Прикрепите материалы')
        stage.attachedMaterials.push(...files)
        stage.status = 'submitted'
        stage.submittedAt = new Date().toISOString()
      }
    } else {
      this.requireCaseManager(entry.caseId)
      if (stage.status !== 'submitted') throw new Error('Проверить можно только сданный этап')
      if (action === 'needs_work' && !feedback.trim()) throw new Error('Укажите причину доработки')
      stage.status = action
      stage.feedback = feedback
    }
    save('executions', this.executions)
    return entry
  }

  getSharedPlan(caseId: string): ProjectMilestone[] {
    const user = this.actor(),
      project = this.cases.find((c) => c.id === caseId)
    if (!project || (!isPublished(project) && !canManageCase(user, project) && !canModerate(user)))
      throw new Error('Проект недоступен')
    return this.milestones
      .filter((m) => m.caseId === caseId)
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((m) => ({
        ...m,
        status: 'pending',
        attachedMaterials: [],
        submittedAt: undefined,
        feedback: undefined,
      }))
  }
  updateSharedPlan(
    caseId: string,
    rows: Pick<ProjectMilestone, 'id' | 'title' | 'description' | 'deadline'>[],
  ): ProjectMilestone[] {
    const project = this.requireCaseManager(caseId)
    if (project.status === 'completed') throw new Error('Проект завершён, план зафиксирован')
    if (
      new Set(rows.map((r) => r.id)).size !== rows.length ||
      rows.some(
        (r) =>
          !r.id ||
          !r.title.trim() ||
          r.title.length > 150 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(r.deadline) ||
          !Number.isFinite(Date.parse(r.deadline)) ||
          new Date(r.deadline).toISOString().slice(0, 10) !== r.deadline,
      )
    )
      throw new Error('Укажите уникальные этапы, названия и корректные даты')
    if (rows.some((r) => this.milestones.some((m) => m.id === r.id && m.caseId !== caseId)))
      throw new Error('Этап принадлежит другому проекту')
    // Individual stage extensions may exceed the original case deadline.
    this.syncExecutions(caseId)
    const previous = this.milestones.filter((m) => m.caseId === caseId)
    const removed = previous.filter((m) => !rows.some((r) => r.id === m.id))
    if (
      removed.some(
        (m) =>
          m.attachedMaterials.length ||
          m.status !== 'pending' ||
          this.executions
            .filter((e) => e.caseId === caseId)
            .some((e) =>
              e.milestones?.some(
                (s) =>
                  s.id === `${e.id}::${m.id}` &&
                  (s.attachedMaterials.length || s.status !== 'pending'),
              ),
            ),
      )
    )
      throw new Error(
        'Нельзя удалить этап, по которому уже начата работа. Измените его описание или срок.',
      )
    const updated = rows.map((row, i) => ({
      ...(previous.find((m) => m.id === row.id) || {
        status: 'pending' as const,
        attachedMaterials: [],
      }),
      id: row.id,
      caseId,
      stepNumber: i + 1,
      title: row.title.trim(),
      description: row.description,
      deadline: row.deadline,
    }))
    this.milestones = [...this.milestones.filter((m) => m.caseId !== caseId), ...updated]
    this.executions
      .filter((e) => e.caseId === caseId)
      .forEach((e) => {
        e.milestones = e.milestones?.filter(
          (s) => !removed.some((m) => s.id === `${e.id}::${m.id}`),
        )
      })
    this.syncExecutions(caseId)
    save('milestones', this.milestones)
    save('executions', this.executions)
    return this.getSharedPlan(caseId)
  }

  getExecutions(caseId: string): Execution[] {
    const user = this.actor(),
      project = this.cases.find((c) => c.id === caseId)
    if (!project || (!isPublished(project) && !canManageCase(user, project) && !canModerate(user)))
      throw new Error('Проект недоступен')
    this.syncExecutions(caseId)
    return this.executions.filter(
      (e) =>
        e.caseId === caseId &&
        (canManageCase(user, project) ||
          canModerate(user) ||
          e.members.some((m) => m.id === user.id)),
    )
  }
  submitExecution(
    id: string,
    description: string,
    files: { name: string; url: string }[],
    demoUrl?: string,
  ): Execution {
    const user = this.actor(),
      entry = this.executions.find((e) => e.id === id)
    if (!entry || user.role !== 'student' || !entry.members.some((m) => m.id === user.id))
      throw new Error('Нет прав на сдачу этой работы')
    if (this.cases.find((c) => c.id === entry.caseId)?.status === 'completed')
      throw new Error('Приём работ завершён')
    if (entry.evaluation) throw new Error('Оценённую работу нельзя заменить')
    if (!description.trim()) throw new Error('Опишите решение')
    entry.submission = {
      id: `submission_${id}`,
      caseId: entry.caseId,
      studentId: user.id,
      teamId: entry.teamId,
      authorName: user.fullName,
      description,
      repoUrl: '',
      demoUrl,
      screenshots: [],
      attachedFiles: files,
      submittedAt: new Date().toISOString(),
    }
    entry.status = 'submitted'
    save('executions', this.executions)
    return entry
  }
  gradeExecution(id: string, scores: Record<string, number>, feedback: string): Execution {
    const entry = this.executions.find((e) => e.id === id)
    if (!entry) throw new Error('Выполнение не найдено')
    const project = this.requireCaseManager(entry.caseId),
      user = this.actor()
    if (project.status === 'completed') throw new Error('Итоги опубликованы, оценки зафиксированы')
    if (!entry.submission) throw new Error('Работа ещё не сдана')
    const items =
      project.kind === 'olympiad'
        ? (project.olympiadTasks || []).map((t) => ({ id: t.id, max: t.maxScore, weight: 1 }))
        : (project.evaluationCriteria || legacyCriteria).map((c) => ({
            ...c,
            max: c.maxScore ?? 10,
          }))
    if (
      !items.length ||
      items.some((c) => !Number.isFinite(scores[c.id]) || scores[c.id] < 0 || scores[c.id] > c.max)
    )
      throw new Error('Укажите баллы в пределах максимума каждой задачи или критерия')
    const clean = Object.fromEntries(items.map((c) => [c.id, scores[c.id]]))
    const total =
      project.kind === 'olympiad'
        ? Object.values(clean).reduce((a, b) => a + b, 0)
        : evaluationTotal(
            items.map((c) => ({
              id: c.id,
              label: '',
              weight: c.weight,
              maxScore: ('maxScore' in c ? c.maxScore : undefined) as number | undefined,
            })),
            clean,
          )
    entry.evaluation = {
      id: `evaluation_${id}`,
      caseId: entry.caseId,
      companyId: project.companyId,
      companyName: project.companyName,
      evaluatorName: user.fullName,
      scores: clean,
      totalScore: total,
      maxScore: items.reduce((a, c) => a + c.max, 0),
      feedback,
      evaluatedAt: new Date().toISOString(),
    }
    entry.status = 'evaluated'
    save('executions', this.executions)
    return entry
  }
  getLeaderboard(caseId: string) {
    this.actor()
    const project = this.cases.find((c) => c.id === caseId)
    if (!project || (!isPublished(project) && !canManageCase(this.sessionUser(), project)))
      throw new Error('Проект недоступен')
    this.syncExecutions(caseId)
    const all = this.executions.filter((e) => e.caseId === caseId),
      complete =
        project.status === 'completed' &&
        all.some((e) => !!e.evaluation) &&
        all.filter((e) => e.submission).every((e) => !!e.evaluation)
    return {
      complete,
      items: all
        .filter((e) => e.evaluation)
        .map((e) => ({
          id: e.id,
          name: e.name,
          score: e.evaluation!.totalScore,
          max: e.evaluation!.maxScore,
        }))
        .sort((a, b) => b.score - a.score),
    }
  }
  finalizeResults(caseId: string): void {
    const project = this.requireCaseManager(caseId)
    this.syncExecutions(caseId)
    const submitted = this.executions.filter((e) => e.caseId === caseId && e.submission)
    if (!submitted.length || submitted.some((e) => !e.evaluation))
      throw new Error('Сначала оцените все сданные работы')
    project.status = 'completed'
    save('cases', this.cases)
  }
  withdrawResults(caseId: string): void {
    const project = this.requireCaseManager(caseId)
    if (project.status !== 'completed') return
    project.status = 'in_progress'
    save('cases', this.cases)
  }
  getStudentAchievements(studentId: string) {
    this.actor()
    const cases = this.cases.filter((c) => c.status === 'completed' && isPublished(c))
    cases.forEach((c) => this.syncExecutions(c.id))
    return this.executions
      .filter(
        (e) =>
          cases.some((c) => c.id === e.caseId) &&
          e.members.some((m) => m.id === studentId) &&
          e.evaluation,
      )
      .map((e) => ({
        caseId: e.caseId,
        score: e.evaluation!.totalScore,
        maxScore: e.evaluation!.maxScore,
      }))
  }

  private actor(): User {
    const user = this.sessionUser()
    if (!user || user.isBlocked) throw new Error('Войдите в систему')
    return user
  }

  reportContent(
    targetType: ContentReport['targetType'],
    targetId: string,
    reason: string,
    message: string,
  ): ContentReport {
    const user = this.actor()
    if (!reason.trim()) throw new Error('Выберите причину')
    if (
      this.reports.some(
        (r) =>
          r.authorId === user.id &&
          r.targetId === targetId &&
          r.targetType === targetType &&
          r.status === 'pending',
      )
    )
      throw new Error('Ваша жалоба уже на рассмотрении')
    const report: ContentReport = {
      id: createId(),
      authorId: user.id,
      targetType,
      targetId,
      reason,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    this.reports.push(report)
    save('reports', this.reports)
    return report
  }
  getReports(): ContentReport[] {
    this.requireAdmin()
    return this.reports
  }
  resolveReport(id: string): void {
    this.requireAdmin()
    const report = this.reports.find((r) => r.id === id)
    if (report) report.status = 'resolved'
    save('reports', this.reports)
  }

  setStudentProjectVisibility(id: string, visibility: 'private' | 'public'): StudentProject {
    const project = this.studentProjects.find((p) => p.id === id)
    if (!project || project.authorId !== this.actor().id) throw new Error('Нет прав на публикацию')
    if (visibility === 'public') {
      if (project.visibility !== 'private' && project.moderationStatus === 'pending')
        throw new Error('Проект уже на рассмотрении')
      project.isModerated = false
      project.moderationStatus = 'pending'
      project.moderationComment = undefined
      this.notifyReviewers('student', project.title)
    }
    project.visibility = visibility
    save('studentProjects', this.studentProjects)
    return project
  }
  updateCompanyContent(
    id: string,
    patch: { description: string; internshipProgram?: string; practiceProgram?: string },
  ): Company {
    const user = this.actor()
    if (
      user.role !== 'admin' &&
      !(user.role === 'company' && user.companyProfile?.companyId === id)
    )
      throw new Error('Нет прав на изменение компании')
    const company = this.companies.find((c) => c.id === id)
    if (!company) throw new Error('Компания не найдена')
    Object.assign(company, patch)
    save('companies', this.companies)
    return company
  }
  assignStudentCurator(studentId: string, curatorId: string): User {
    const user = this.actor()
    if (!canModerate(user) || (user.role === 'curator' && curatorId !== user.id))
      throw new Error('Нет прав назначить куратора')
    if (!this.users.some((u) => u.id === curatorId && u.role === 'curator'))
      throw new Error('Куратор не найден')
    const student = this.users.find((u) => u.id === studentId && u.role === 'student')
    if (!student?.studentProfile) throw new Error('Студент не найден')
    student.studentProfile.curatorId = curatorId
    save('users', this.users)
    return student
  }

  likeComment(id: string): ProjectComment {
    const user = this.actor()
    const comment = this.comments.find((c) => c.id === id)
    if (!comment || !this.getCaseById(comment.caseId)) throw new Error('Комментарий недоступен')
    const likes = comment.likedBy || []
    comment.likedBy = likes.includes(user.id)
      ? likes.filter((uid) => uid !== user.id)
      : [...likes, user.id]
    save('comments', this.comments)
    return comment
  }

  getTeamRequests(): TeamRequest[] {
    const user = this.actor()
    return this.teamRequests.filter(
      (r) =>
        r.studentId === user.id ||
        r.senderId === user.id ||
        this.teams.some((t) => t.id === r.teamId && t.leaderId === user.id),
    )
  }
  requestTeam(
    teamId: string,
    studentId: string,
    kind: TeamRequest['kind'],
    message: string,
  ): TeamRequest {
    const user = this.actor()
    const team = this.teams.find((t) => t.id === teamId)
    if (
      user.role !== 'student' ||
      !team ||
      !this.users.some((u) => u.id === studentId && u.role === 'student')
    )
      throw new Error('Команда или студент не найдены')
    if (kind === 'invitation' ? team.leaderId !== user.id : studentId !== user.id)
      throw new Error('Нет прав отправить заявку')
    if (team.members.some((m) => m.id === studentId) || team.leaderId === studentId)
      throw new Error('Студент уже в команде')
    if (
      this.teamRequests.some(
        (r) => r.teamId === teamId && r.studentId === studentId && r.status === 'pending',
      )
    )
      throw new Error('Заявка уже отправлена')
    const request: TeamRequest = {
      id: createId(),
      teamId,
      studentId,
      senderId: user.id,
      kind,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    this.teamRequests.push(request)
    save('teamRequests', this.teamRequests)
    const notificationId = createId()
    this.notifications.unshift({
      id: notificationId,
      userId: kind === 'invitation' ? studentId : team.leaderId,
      type: 'team_invite',
      title:
        kind === 'invitation'
          ? `Приглашение в команду ${team.name}`
          : `Заявка в команду ${team.name}`,
      message,
      read: false,
      link: `/invitations/${notificationId}`,
      createdAt: request.createdAt,
      invitation: {
        teamId,
        caseId: team.caseId,
        senderId: user.id,
        senderName: user.fullName,
        reason: kind === 'invitation' ? 'Приглашение в команду' : 'Заявка на вступление',
        status: 'pending',
        replies: [],
      },
    })
    save('notifications', this.notifications)
    return request
  }
  decideTeamRequest(id: string, status: 'accepted' | 'rejected'): TeamRequest {
    const user = this.actor()
    const request = this.teamRequests.find((r) => r.id === id)
    const team = this.teams.find((t) => t.id === request?.teamId)
    if (
      !request ||
      !team ||
      (request.kind === 'invitation' ? request.studentId !== user.id : team.leaderId !== user.id)
    )
      throw new Error('Нет прав на решение')
    if (request.status !== 'pending') throw new Error('Решение уже принято')
    if (status === 'accepted' && !team.members.some((m) => m.id === request.studentId)) {
      const student = this.users.find((u) => u.id === request.studentId)!
      team.members.push({
        id: student.id,
        name: student.fullName,
        role: 'Участник',
        competencies: student.studentProfile?.skills || [],
        avatar: student.avatar,
        email: student.email,
      })
      save('teams', this.teams)
      this.seekers = this.seekers.filter(
        (s) => !(s.studentId === student.id && s.caseId === team.caseId),
      )
      save('seekers', this.seekers)
    }
    request.status = status
    save('teamRequests', this.teamRequests)
    this.notifications
      .filter(
        (n) =>
          n.invitation?.teamId === team.id &&
          n.invitation?.senderId === request.senderId &&
          n.userId === user.id &&
          n.invitation.status === 'pending',
      )
      .forEach((n) => {
        n.invitation!.status = status
      })
    save('notifications', this.notifications)
    return request
  }
  getSeekers(caseId?: string): TeamSeeker[] {
    this.actor()
    if (caseId && !this.getCaseById(caseId)) throw new Error('Кейс недоступен')
    return this.seekers.filter((s) => !caseId || !s.caseId || s.caseId === caseId)
  }
  saveSeeker(caseId: string | undefined, message: string, techStack: string[]): TeamSeeker {
    const user = this.actor()
    caseId = caseId || undefined
    if (user.role !== 'student' || (caseId && !this.getCaseById(caseId)) || !message.trim())
      throw new Error('Заполните анкету студента')
    if (
      caseId &&
      this.teams.some(
        (t) =>
          (t.caseId === caseId || t.recruitingCaseId === caseId) &&
          (t.leaderId === user.id || t.members.some((m) => m.id === user.id)),
      )
    )
      throw new Error('Вы уже состоите в команде этого кейса')
    const seeker = {
      id: createId(),
      caseId: caseId || undefined,
      studentId: user.id,
      message: message.trim(),
      techStack: techStack.map((s) => s.trim()).filter(Boolean),
    }
    this.seekers = this.seekers.filter((s) => s.studentId !== user.id)
    this.seekers.push(seeker)
    save('seekers', this.seekers)
    return seeker
  }
  linkTeamToCase(teamId: string, caseId: string): ProjectTeam {
    const user = this.actor()
    const team = this.teams.find((t) => t.id === teamId)
    if (!team || team.leaderId !== user.id || !this.getCaseById(caseId))
      throw new Error('Нет прав на команду')
    if (
      (team.caseId && team.caseId !== caseId) ||
      (team.recruitingCaseId && team.recruitingCaseId !== caseId)
    )
      throw new Error('Команда уже участвует в другом кейсе')
    team.recruitingCaseId = caseId
    save('teams', this.teams)
    return team
  }
  getInvitation(id: string): SystemNotification {
    const user = this.actor()
    const notification = this.notifications.find((n) => n.id === id && n.invitation)
    if (
      !notification ||
      (notification.userId !== user.id && notification.invitation!.senderId !== user.id)
    )
      throw new Error('Приглашение недоступно')
    return notification
  }
  respondInvitation(
    id: string,
    status?: 'accepted' | 'rejected',
    message?: string,
  ): SystemNotification {
    const user = this.actor()
    const notification = this.getInvitation(id)
    const invitation = notification.invitation!
    if (status && (notification.userId !== user.id || invitation.status !== 'pending'))
      throw new Error('Решение недоступно')
    if (message?.trim())
      invitation.replies.push({
        authorId: user.id,
        authorName: user.fullName,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      })
    if (status) {
      if (notification.userId !== user.id || invitation.status !== 'pending')
        throw new Error('Решение недоступно')
      if (invitation.teamId) {
        const request = this.teamRequests.find(
          (r) =>
            r.teamId === invitation.teamId &&
            r.senderId === invitation.senderId &&
            r.status === 'pending' &&
            (r.studentId === user.id ||
              this.teams.find((t) => t.id === r.teamId)?.leaderId === user.id),
        )
        if (!request) throw new Error('Заявка не найдена')
        this.decideTeamRequest(request.id, status)
      }
      invitation.status = status
    }
    notification.read = true
    save('notifications', this.notifications)
    const recipient = user.id === notification.userId ? invitation.senderId : notification.userId
    this.notifications.unshift({
      id: createId(),
      userId: recipient,
      type: notification.type,
      title: 'Ответ на приглашение',
      message:
        message?.trim() ||
        (status === 'accepted' ? 'Приглашение принято' : 'Приглашение отклонено'),
      link: `/invitations/${id}`,
      read: false,
      createdAt: new Date().toISOString(),
    })
    save('notifications', this.notifications)
    return notification
  }

  // Users & Auth
  getUsers(): User[] {
    return this.users
  }

  getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id)
  }

  updateUser(updated: User): User {
    this.users = this.users.map((u) => (u.id === updated.id ? updated : u))
    save('users', this.users)
    return updated
  }

  toggleUserBlock(userId: string, reason = ''): User {
    this.requireAdmin()
    if (this.sessionUser()?.id === userId) throw new Error('Нельзя заблокировать свой аккаунт.')
    const user = this.users.find((u) => u.id === userId)
    const admin = this.sessionUser()!
    if (user) {
      user.isBlocked = !user.isBlocked
      save('users', this.users)
      this.logAudit({
        userId: admin.id,
        userName: admin.fullName,
        userRole: 'admin',
        actionType: 'user_blocked',
        objectType: 'User',
        objectId: user.id,
        objectName: user.fullName,
        previousValue: user.isBlocked ? 'Разблокирован' : 'Заблокирован',
        newValue: user.isBlocked ? 'Заблокирован' : 'Разблокирован',
        details: reason.trim() || 'Статус пользователя изменён',
      })
    }
    return user!
  }

  changeUserRole(userId: string, newRole: User['role']): User {
    this.requireAdmin()
    if (this.sessionUser()?.id === userId) throw new Error('Нельзя изменить свою роль.')
    const user = this.users.find((u) => u.id === userId)
    if (user) {
      const prev = user.role
      user.role = newRole
      save('users', this.users)
      this.logAudit({
        userId: 'usr_admin_1',
        userName: 'Наиль Хисамов',
        userRole: 'admin',
        actionType: 'user_role_change',
        objectType: 'User',
        objectId: user.id,
        objectName: user.fullName,
        previousValue: prev,
        newValue: newRole,
        details: `Смена роли пользователя`,
      })
    }
    return user!
  }

  registerUser(data: {
    fullName: string
    email: string
    username: string
    password?: string
    role: 'student' | 'company'
    phone?: string
    group?: string
    institute?: string
    direction?: string
    course?: number
    technologies?: string[]
    companyName?: string
  }): User {
    const existing = this.users.find(
      (u) =>
        u.email.toLowerCase() === data.email.toLowerCase() ||
        u.username.toLowerCase() === data.username.toLowerCase(),
    )
    if (existing) {
      throw new Error('Пользователь с таким email или логином уже зарегистрирован')
    }

    const id = `usr_${data.role}_${Date.now()}`
    const newUser: User = {
      id,
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      phone: data.phone || '',
      createdAt: new Date().toISOString(),
    }

    if (data.role === 'student') {
      newUser.studentProfile = {
        university: 'Уфимский университет науки и технологий (УУНиТ)',
        institute: data.institute || 'Институт информатики, математики и робототехники',
        fieldOfStudy: data.direction || '',
        educationalProgram: '',
        course: data.course || 1,
        group: data.group || '',
        bio: '',
        interests: [],
        skills: [],
        techStack: data.technologies || [],
        githubUrl: '',
        phone: data.phone || '',
        rating: 0,
        verifiedProjectsCount: 0,
        winsCount: 0,
      }
    } else if (data.role === 'company') {
      const companyId = `comp_${Date.now()}`
      newUser.companyProfile = {
        companyId,
        companyName: data.companyName || 'ООО «ИТ Партнер»',
        position: 'Руководитель направления',
      }
      this.companies.push({
        id: companyId,
        name: data.companyName || 'ООО «ИТ Партнер»',
        shortName: data.companyName || 'ИТ Партнер',
        logo: '',
        industry: 'Информационные технологии',
        description: 'Партнёрская ИТ-компания университета',
        website: 'https://uust.ru',
        email: data.email,
        phone: data.phone || '+7 (347) 200-00-00',
        contactPerson: `${data.fullName}, Представитель`,
        directions: ['Frontend', 'Backend'],
        activeCasesCount: 0,
        completedProjectsCount: 0,
        techStack: ['React', 'Python'],
        isVerified: false,
        isModerated: false,
      })
      save('companies', this.companies)
    }

    this.users.push(newUser)
    save('users', this.users)

    this.logAudit({
      userId: newUser.id,
      userName: newUser.fullName,
      userRole: newUser.role,
      actionType: 'auth_login',
      objectType: 'User',
      objectId: newUser.id,
      objectName: newUser.fullName,
      details: `Регистрация нового пользователя (${newUser.role}) в системе`,
    })

    return newUser
  }

  // Companies
  getCompanies(): Company[] {
    return this.companies.filter(
      (c) =>
        !c.isBlocked ||
        this.actor().role === 'admin' ||
        this.actor().companyProfile?.companyId === c.id,
    )
  }

  getCompanyById(id: string): Company | undefined {
    return this.companies.find((c) => c.id === id)
  }

  updateCompany(updated: Company): Company {
    this.companies = this.companies.map((c) => (c.id === updated.id ? updated : c))
    save('companies', this.companies)
    return updated
  }

  suspendCompany(id: string): Company {
    this.requireAdmin()
    const company = this.companies.find((c) => c.id === id)
    if (!company) throw new Error('Компания не найдена')
    company.isBlocked = true
    save('companies', this.companies)
    return company
  }
  verifyCompany(companyId: string, status: boolean): Company {
    this.requireAdmin()
    const comp = this.companies.find((c) => c.id === companyId)
    if (comp) {
      comp.isVerified = status
      comp.isModerated = true
      save('companies', this.companies)
      this.logAudit({
        userId: 'usr_curator_1',
        userName: 'Елена Ахметова',
        userRole: 'curator',
        actionType: 'moderation_action',
        objectType: 'Company',
        objectId: comp.id,
        objectName: comp.name,
        previousValue: 'Не верифицирована',
        newValue: status ? 'Верифицирована' : 'Отклонена',
        details: 'Модерация компании сотрудником УУНиТ',
      })
    }
    return comp!
  }

  // Cases
  getCases(filters?: {
    search?: string
    direction?: string
    complexity?: string
    participationFormat?: string
    workFormat?: string
    rewardType?: string
    status?: string
    companyId?: string
    hasReward?: boolean
  }): CaseProject[] {
    let result = [...visibleCasesFor(this.sessionUser(), this.cases)]
    if (!filters) return result

    if (filters.search) {
      result = result.filter((c) =>
        matchesSearch(
          filters.search!,
          c.title,
          c.companyName,
          c.shortDescription,
          c.requiredCompetencies,
          c.recommendedTech,
          c.direction,
        ),
      )
    }
    if (filters.direction && filters.direction !== 'all') {
      result = result.filter((c) => c.direction === filters.direction)
    }
    if (filters.complexity && filters.complexity !== 'all') {
      result = result.filter((c) => c.complexity === filters.complexity)
    }
    if (filters.participationFormat && filters.participationFormat !== 'all') {
      result = result.filter(
        (c) =>
          c.participationFormat === filters.participationFormat || c.participationFormat === 'both',
      )
    }
    if (filters.workFormat && filters.workFormat !== 'all') {
      result = result.filter((c) => c.workFormat === filters.workFormat)
    }
    if (filters.rewardType && filters.rewardType !== 'all') {
      result = result.filter((c) => c.rewardType === filters.rewardType)
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((c) => c.status === filters.status)
    }
    if (filters.companyId) {
      result = result.filter((c) => c.companyId === filters.companyId)
    }
    if (filters.hasReward) {
      result = result.filter((c) => c.rewardType === 'monetary' || c.rewardType === 'contest')
    }

    return result
  }

  getCaseById(id: string): CaseProject | undefined {
    return visibleCasesFor(this.sessionUser(), this.cases).find((c) => c.id === id)
  }

  createCase(
    caseData: Omit<CaseProject, 'id' | 'viewsCount' | 'applicationsCount' | 'publishedAt'>,
  ): CaseProject {
    if (
      caseData.maxTeams != null &&
      (!Number.isInteger(caseData.maxTeams) || caseData.maxTeams < 1)
    )
      throw new Error('Укажите целое число команд от 1')
    const user = this.sessionUser()
    if (
      !user ||
      (user.role !== 'admin' &&
        (user.role !== 'company' || user.companyProfile?.companyId !== caseData.companyId))
    ) {
      throw new Error('Нет прав на публикацию кейса от этой компании')
    }
    if (
      user.role === 'company' &&
      !this.companies.find((company) => company.id === caseData.companyId)?.isVerified
    ) {
      throw new Error('Дождитесь верификации компании перед размещением кейса')
    }
    const newCase: CaseProject = {
      ...caseData,
      status: 'moderation',
      isModerated: false,
      moderationStatus: 'pending',
      id: `case_${Date.now()}`,
      viewsCount: 0,
      applicationsCount: 0,
      publishedAt: new Date().toISOString().split('T')[0],
    }
    this.cases.unshift(newCase)
    save('cases', this.cases)
    this.notifyReviewers('case', newCase.title)

    // Automatically generate 7 milestones for standard case
    const standardTitles: ProjectMilestone['title'][] = [
      'Анализ задачи',
      'Проектирование',
      'Создание прототипа',
      'Разработка MVP',
      'Тестирование',
      'Финальная версия',
      'Защита проекта',
    ]
    standardTitles.forEach((title, idx) => {
      this.milestones.push({
        id: `ms_${newCase.id}_${idx + 1}`,
        caseId: newCase.id,
        stepNumber: idx + 1,
        title,
        deadline: new Date(Date.now() + (idx + 1) * 12 * 86400000).toISOString().split('T')[0],
        description: `Этап ${idx + 1}: ${title}`,
        status: idx === 0 ? 'in_progress' : 'pending',
        attachedMaterials: [],
      })
    })
    save('milestones', this.milestones)

    this.logAudit({
      userId: 'usr_company_1',
      userName: 'Роман Семёнов',
      userRole: 'company',
      actionType: 'case_create',
      objectType: 'CaseProject',
      objectId: newCase.id,
      objectName: newCase.title,
      newValue: 'Создан новый кейс',
      details: `Размещен кейс по направлению ${newCase.direction}`,
    })

    return newCase
  }

  updateCase(updated: CaseProject): CaseProject {
    this.requireCaseManager(updated.id)
    if (updated.maxTeams != null && (!Number.isInteger(updated.maxTeams) || updated.maxTeams < 1))
      throw new Error('Укажите целое число команд от 1')
    if (
      updated.maxTeams &&
      updated.maxTeams <
        this.applications.filter((a) => a.caseId === updated.id && a.status === 'accepted').length
    )
      throw new Error('Лимит меньше числа уже принятых команд')
    const prev = this.cases.find((c) => c.id === updated.id)
    if (
      prev?.olympiadTasks?.length &&
      JSON.stringify(prev.olympiadTasks) !== JSON.stringify(updated.olympiadTasks)
    )
      throw new Error('Задачи и максимумы после публикации не меняются')
    if (JSON.stringify(prev?.evaluationCriteria) !== JSON.stringify(updated.evaluationCriteria))
      throw new Error('Критерии после создания не меняются')
    if (this.sessionUser()?.role === 'company') {
      updated = {
        ...updated,
        companyId: prev!.companyId,
        isModerated: prev!.isModerated,
        moderationStatus: prev!.moderationStatus,
      }
      if (!isPublished(prev!)) updated.status = 'moderation'
    }
    this.cases = this.cases.map((c) => (c.id === updated.id ? updated : c))
    save('cases', this.cases)

    if (prev && prev.status !== updated.status) {
      this.logAudit({
        userId: 'system',
        userName: 'Система',
        userRole: 'admin',
        actionType: 'status_change',
        objectType: 'CaseProject',
        objectId: updated.id,
        objectName: updated.title,
        previousValue: prev.status,
        newValue: updated.status,
        details: 'Изменение статуса кейса',
      })
    }

    return updated
  }

  deleteCase(id: string): void {
    this.requireCaseManager(id)
    const c = this.cases.find((x) => x.id === id)
    this.cases = this.cases.filter((x) => x.id !== id)
    save('cases', this.cases)
    if (c) {
      this.logAudit({
        userId: 'usr_admin_1',
        userName: 'Наиль Хисамов',
        userRole: 'admin',
        actionType: 'case_delete',
        objectType: 'CaseProject',
        objectId: id,
        objectName: c.title,
        details: 'Кейс удален',
      })
    }
  }

  // Favorites
  getFavorites(): string[] {
    return this.favorites
  }

  toggleFavorite(caseId: string): string[] {
    if (this.favorites.includes(caseId)) {
      this.favorites = this.favorites.filter((id) => id !== caseId)
    } else {
      this.favorites.push(caseId)
    }
    save('favorites', this.favorites)
    return this.favorites
  }

  // NDA acceptance
  isNDAAccepted(caseId: string, userId: string): boolean {
    return this.ndaAccepted.includes(`${caseId}_${userId}`)
  }

  acceptNDA(caseId: string, userId: string): boolean {
    const key = `${caseId}_${userId}`
    if (!this.ndaAccepted.includes(key)) {
      this.ndaAccepted.push(key)
      save('ndaAccepted', this.ndaAccepted)
    }
    return true
  }

  // Applications
  getApplications(caseId?: string, studentId?: string): CaseApplication[] {
    let result = [...this.applications]
    const user = this.sessionUser()
    if (user?.role === 'company')
      result = result.filter((a) => a.companyId === user.companyProfile?.companyId)
    if (user?.role === 'student') result = result.filter((a) => a.studentId === user.id)
    if (caseId) result = result.filter((a) => a.caseId === caseId)
    if (studentId) result = result.filter((a) => a.studentId === studentId)
    return result
  }

  createApplication(data: Omit<CaseApplication, 'id' | 'createdAt' | 'status'>): CaseApplication {
    const user = this.sessionUser()
    const project = this.cases.find((item) => item.id === data.caseId)
    if (!user || user.role !== 'student' || data.studentId !== user.id)
      throw new Error('Заявку может подать только студент от своего имени')
    if (!project || !isPublished(project) || !canReceiveApplications(project))
      throw new Error('Кейс не открыт для заявок')
    if (project.companyId !== data.companyId) throw new Error('Компания не соответствует кейсу')
    if (data.applicantType === 'team') {
      const team = this.teams.find((t) => t.id === data.teamId)
      if (!team || team.leaderId !== user.id || (team.caseId && team.caseId !== project.id))
        throw new Error('Командную заявку подает капитан своей команды')
      if (team.members.length < project.teamSize.min || team.members.length > project.teamSize.max)
        throw new Error('Состав команды не соответствует условиям кейса')
    }
    if (
      project.participationFormat !== 'both' &&
      data.applicantType !== project.participationFormat
    )
      throw new Error('Выбран неверный формат участия')
    if (
      data.teamId &&
      this.applications.some((a) => a.caseId === data.caseId && a.teamId === data.teamId)
    )
      throw new Error('Команда уже зарегистрирована')
    if (
      this.executions.some(
        (e) =>
          e.caseId === data.caseId &&
          (data.teamId ? e.teamId === data.teamId : e.members.some((m) => m.id === user.id)),
      )
    )
      throw new Error('Вы уже участвуете в этом проекте')
    if (this.applications.some((app) => app.caseId === data.caseId && app.studentId === user.id))
      throw new Error('Вы уже подали заявку')
    const newApp: CaseApplication = {
      ...data,
      id: `app_${Date.now()}`,
      status: openRegistration(project) ? 'accepted' : 'pending',
      createdAt: new Date().toISOString(),
    }
    this.applications.unshift(newApp)
    save('applications', this.applications)

    // Update case applicationsCount
    const c = this.cases.find((x) => x.id === data.caseId)
    if (c) {
      c.applicationsCount += 1
      save('cases', this.cases)
    }

    if (openRegistration(project)) {
      project.acceptedTeamsCount =
        Math.max(
          project.acceptedTeamsCount || 0,
          this.executions.filter((e) => e.caseId === project.id).length,
        ) + 1
      if (data.teamId) {
        const team = this.teams.find((t) => t.id === data.teamId)
        if (team) {
          team.caseId = project.id
          save('teams', this.teams)
        }
      }
      save('cases', this.cases)
      this.syncExecutions(project.id)
    }
    // Create notification for company
    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: 'usr_company_1',
      type: 'company_invite',
      title: 'Новая заявка на кейс!',
      message: `Студент ${data.studentName} подал заявку на проект «${data.caseTitle}».`,
      read: false,
      link: `/cases/${data.caseId}`,
      createdAt: new Date().toISOString(),
    })
    save('notifications', this.notifications)

    return newApp
  }

  updateApplicationStatus(
    appId: string,
    status: CaseApplication['status'],
    notes?: string,
  ): CaseApplication {
    const app = this.applications.find((a) => a.id === appId)
    if (!app) throw new Error('Заявка не найдена')
    this.requireCaseManager(app.caseId)
    if (app.status === 'accepted' && status === 'interview')
      throw new Error('Студент уже принят в команду')
    if (['accepted', 'rejected'].includes(app.status))
      throw new Error('Решение по заявке уже принято')
    const project = this.cases.find((c) => c.id === app.caseId)!
    this.syncExecutions(app.caseId)
    if (
      status === 'accepted' &&
      project.maxTeams &&
      this.applications.filter((a) => a.caseId === project.id && a.status === 'accepted').length >=
        project.maxTeams
    )
      throw new Error('Лимит команд на кейс достигнут')
    if (app) {
      const prev = app.status
      app.status = status
      if (notes) app.companyNotes = notes
      save('applications', this.applications)

      if (status === 'accepted') this.syncExecutions(app.caseId)
      // If accepted, update case status to in_progress
      if (status === 'accepted') {
        if (app.teamId) {
          const team = this.teams.find((t) => t.id === app.teamId)
          if (team) {
            team.caseId = app.caseId
            save('teams', this.teams)
          }
        }
        const c = this.cases.find((x) => x.id === app.caseId)
        if (c) {
          c.status = 'in_progress'
          c.acceptedTeamsCount = this.applications.filter(
            (a) => a.caseId === c.id && a.status === 'accepted',
          ).length
          c.assignedStudentId = app.studentId
          c.assignedStudentName = app.studentName
          if (app.teamId) {
            c.assignedTeamId = app.teamId
            c.assignedTeamName = app.teamName
          }
          save('cases', this.cases)
        }
      }

      // Notify student
      this.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: app.studentId,
        type: 'application_status',
        title: status === 'accepted' ? 'Заявка принята!' : 'Статус заявки изменен',
        message:
          status === 'accepted'
            ? `Поздравляем! Ваша заявка на кейс «${app.caseTitle}» одобрена. Проект перешел в статус выполнения.`
            : `Статус заявки на «${app.caseTitle}»: ${status}. Заметка: ${notes || 'без комментариев'}`,
        read: false,
        link: `/cases/${app.caseId}/workspace`,
        createdAt: new Date().toISOString(),
      })
      save('notifications', this.notifications)

      this.logAudit({
        userId: 'usr_company_1',
        userName: 'Роман Семёнов',
        userRole: 'company',
        actionType: status === 'accepted' ? 'application_accept' : 'application_reject',
        objectType: 'Application',
        objectId: app.id,
        objectName: app.caseTitle,
        previousValue: prev,
        newValue: status,
        details: `Заявка ${app.studentName}: ${status}`,
      })
    }
    return { ...app! }
  }

  // Milestones
  getMilestones(caseId: string): ProjectMilestone[] {
    return this.milestones.filter((m) => m.caseId === caseId)
  }

  submitMilestone(
    milestoneId: string,
    materials: { name: string; url: string; size?: string }[],
  ): ProjectMilestone {
    const m = this.milestones.find((x) => x.id === milestoneId)
    const user = this.sessionUser()
    const project = this.cases.find((c) => c.id === m?.caseId)
    if (
      !user ||
      user.role !== 'student' ||
      !project ||
      !participatesInCase(user.id, project, this.teams)
    )
      throw new Error('Материалы может сдавать только участник проекта')
    if (m) {
      m.status = 'submitted'
      m.submittedAt = new Date().toISOString().split('T')[0]
      m.attachedMaterials = [...m.attachedMaterials, ...materials]
      save('milestones', this.milestones)
    }
    return m!
  }
  removeMaterial(milestoneId: string, index: number): ProjectMilestone {
    const milestone = this.milestones.find((m) => m.id === milestoneId)
    const user = this.actor()
    const project = this.cases.find((c) => c.id === milestone?.caseId)
    if (!milestone || !project || !participatesInCase(user.id, project, this.teams))
      throw new Error('Удалять материалы может только участник проекта')
    if (milestone.status === 'accepted') throw new Error('Материалы принятого этапа нельзя удалять')
    milestone.attachedMaterials = milestone.attachedMaterials.filter((_, i) => i !== index)
    save('milestones', this.milestones)
    return milestone
  }

  updateMilestoneStatus(
    milestoneId: string,
    status: ProjectMilestone['status'],
    feedback?: string,
  ): ProjectMilestone {
    const m = this.milestones.find((x) => x.id === milestoneId)
    if (!m) throw new Error('Контрольная точка не найдена')
    this.requireCaseManager(m.caseId)
    if (m) {
      m.status = status
      if (feedback) m.feedback = feedback
      save('milestones', this.milestones)
    }
    return m!
  }

  createMilestone(
    caseId: string,
    data: { title: string; description: string; deadline: string },
  ): ProjectMilestone {
    this.requireCaseManager(caseId)
    if (!data.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(data.deadline))
      throw new Error('Укажите название и срок этапа')
    const milestone: ProjectMilestone = {
      ...data,
      title: data.title.trim(),
      id: `milestone_${createId()}`,
      caseId,
      stepNumber: this.getMilestones(caseId).length + 1,
      status: 'pending',
      attachedMaterials: [],
    }
    this.milestones.push(milestone)
    save('milestones', this.milestones)
    return milestone
  }

  deleteMilestone(milestoneId: string): void {
    const milestone = this.milestones.find((m) => m.id === milestoneId)
    if (!milestone) throw new Error('Контрольная точка не найдена')
    this.requireCaseManager(milestone.caseId)
    this.updateSharedPlan(
      milestone.caseId,
      this.milestones.filter((m) => m.caseId === milestone.caseId && m.id !== milestoneId),
    )
  }

  // Submissions & Evaluations
  getSubmission(caseId: string): ProjectSubmission | undefined {
    return this.submissions.find((s) => s.caseId === caseId)
  }

  createSubmission(data: Omit<ProjectSubmission, 'id' | 'submittedAt'>): ProjectSubmission {
    const newSub: ProjectSubmission = {
      ...data,
      id: `sub_${Date.now()}`,
      submittedAt: new Date().toISOString(),
    }
    this.submissions = this.submissions.filter((submission) => submission.caseId !== data.caseId)
    this.submissions.push(newSub)
    save('submissions', this.submissions)

    // Update case status to 'submitted'
    const c = this.cases.find((x) => x.id === data.caseId)
    if (c) {
      c.status = 'submitted'
      save('cases', this.cases)
    }

    return newSub
  }

  getEvaluation(caseId: string): ProjectEvaluation | undefined {
    return this.evaluations.find((e) => e.caseId === caseId)
  }

  createEvaluation(data: Omit<ProjectEvaluation, 'id' | 'evaluatedAt'>): ProjectEvaluation {
    this.requireCaseManager(data.caseId)
    if (!this.getSubmission(data.caseId))
      throw new Error('Сначала необходимо представить результат проекта')
    const newEval: ProjectEvaluation = {
      ...data,
      id: `eval_${Date.now()}`,
      evaluatedAt: new Date().toISOString(),
    }
    this.evaluations = this.evaluations.filter((e) => e.caseId !== data.caseId)
    this.evaluations.push(newEval)
    save('evaluations', this.evaluations)

    // Update case status to 'completed'
    const c = this.cases.find((x) => x.id === data.caseId)
    if (c) {
      c.status = 'completed'
      if (data.winnerPlace) {
        c.winnerInfo = `${data.winnerPlace} место (${newEval.totalScore}/100)`
      }
      save('cases', this.cases)
    }

    this.logAudit({
      userId: 'usr_company_1',
      userName: data.evaluatorName,
      userRole: 'company',
      actionType: 'evaluation_submit',
      objectType: 'CaseProject',
      objectId: data.caseId,
      objectName: c?.title || 'Проект',
      newValue: `${newEval.totalScore}/100 баллов`,
      details: `Выставлена оценка по 10 критериям ТЗ`,
    })

    return newEval
  }

  // Student projects
  getStudentProjects(filters?: {
    search?: string
    category?: string
    direction?: string
    badge?: string
  }): StudentProject[] {
    let list = visibleStudentProjectsFor(this.sessionUser(), this.studentProjects)
    filters ||= {}

    if (filters.search) {
      list = list.filter((p) =>
        matchesSearch(
          filters.search!,
          p.title,
          p.shortDescription,
          p.authorName,
          p.technologies,
          p.direction,
        ),
      )
    }
    if (filters.category && filters.category !== 'all') {
      list = list.filter((p) => p.category === filters.category)
    }
    if (filters.direction && filters.direction !== 'all') {
      list = list.filter((p) => p.direction === filters.direction)
    }
    if (filters.badge && filters.badge !== 'all') {
      list = list.filter((p) => p.badges.includes(filters.badge as any))
    }

    return list.map((p) => ({
      ...p,
      likedByMe: (this.projectLikes[p.id] || []).includes(this.sessionUser()?.id || ''),
    }))
  }

  getStudentProjectById(id: string): StudentProject | undefined {
    const project = visibleStudentProjectsFor(this.sessionUser(), this.studentProjects).find(
      (p) => p.id === id,
    )
    return project
      ? {
          ...project,
          likedByMe: (this.projectLikes[id] || []).includes(this.sessionUser()?.id || ''),
        }
      : undefined
  }

  createStudentProject(
    data: Omit<StudentProject, 'id' | 'createdAt' | 'likesCount' | 'isModerated'>,
  ): StudentProject {
    const user = this.sessionUser()
    if (!user || user.role !== 'student' || data.authorId !== user.id)
      throw new Error('Публиковать проект может только его автор-студент')
    const newProj: StudentProject = {
      ...data,
      id: `sp_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      likesCount: 0,
      isModerated: false,
      moderationStatus: data.visibility === 'private' ? 'hidden' : 'pending',
    }
    this.studentProjects.unshift(newProj)
    save('studentProjects', this.studentProjects)
    if (newProj.visibility !== 'private') this.notifyReviewers('student', newProj.title)
    return newProj
  }

  toggleStudentProjectLike(id: string): StudentProject {
    const user = this.actor()
    if (!this.getStudentProjectById(id)) throw new Error('Проект не найден')
    const project = this.studentProjects.find((p) => p.id === id)!
    const voters = this.projectLikes[id] || []
    const liked = voters.includes(user.id)
    this.projectLikes[id] = liked ? voters.filter((id) => id !== user.id) : [...voters, user.id]
    project.likesCount = Math.max(0, project.likesCount + (liked ? -1 : 1))
    save('studentProjectLikes', this.projectLikes)
    save('studentProjects', this.studentProjects)
    return { ...project, likedByMe: !liked }
  }

  moderatePublication(
    kind: 'case' | 'student',
    id: string,
    status: ModerationStatus,
    comment = '',
  ): CaseProject | StudentProject {
    const user = this.sessionUser()
    if (!canModerate(user)) throw new Error('Нет прав на модерацию публикаций')
    if (status !== 'approved' && !comment.trim()) throw new Error('Укажите причину решения')
    const collection = kind === 'case' ? this.cases : this.studentProjects
    const project = collection.find((item) => item.id === id)
    if (!project) throw new Error('Публикация не найдена')
    if ('visibility' in project && project.visibility === 'private')
      throw new Error('Проект приватный')
    const previous = project.moderationStatus || (project.isModerated ? 'approved' : 'pending')
    const updated = {
      ...project,
      moderationStatus: status,
      moderationComment: comment.trim(),
      isModerated: status === 'approved',
    }
    if (kind === 'case') {
      const caseItem = updated as CaseProject
      if (status === 'approved' && caseItem.status === 'moderation') {
        caseItem.status = 'open'
        caseItem.publishedAt = new Date().toISOString().split('T')[0]
      }
      this.cases = this.cases.map((item) => (item.id === id ? caseItem : item))
      save('cases', this.cases)
    } else {
      this.studentProjects = this.studentProjects.map((item) =>
        item.id === id ? (updated as StudentProject) : item,
      )
      save('studentProjects', this.studentProjects)
    }
    this.logAudit({
      userId: user!.id,
      userName: user!.fullName,
      userRole: user!.role,
      actionType: 'moderation_action',
      objectType: kind === 'case' ? 'CaseProject' : 'StudentProject',
      objectId: id,
      objectName: project.title,
      previousValue: previous,
      newValue: status,
      details: comment.trim(),
    })
    const recipientIds =
      kind === 'student'
        ? [(project as StudentProject).authorId]
        : this.users
            .filter((item) => item.companyProfile?.companyId === (project as CaseProject).companyId)
            .map((item) => item.id)
    recipientIds.forEach((userId) =>
      this.notifications.unshift({
        id: `notification_${Date.now()}_${userId}`,
        userId,
        type: 'publication_status',
        title: `Публикация: ${publicationLabels[status]}`,
        message: `${project.title}${comment ? `. ${comment.trim()}` : ''}`,
        read: false,
        link: kind === 'case' ? `/cases/${id}` : `/student-projects/${id}`,
        createdAt: new Date().toISOString(),
      }),
    )
    save('notifications', this.notifications)
    return updated as CaseProject | StudentProject
  }

  // Teams
  getTeams(): ProjectTeam[] {
    return this.teams
  }

  createTeam(data: Omit<ProjectTeam, 'id' | 'createdAt'>): ProjectTeam {
    const name = data.name.trim()
    if (!name || name.length > TEAM_NAME_MAX_LENGTH)
      throw new Error(`Название команды должно содержать от 1 до ${TEAM_NAME_MAX_LENGTH} символов.`)
    data = { ...data, name }
    const user = this.actor()
    if (user.role !== 'student') throw new Error('Создать команду может студент')
    const newTeam: ProjectTeam = {
      ...data,
      leaderId: user.id,
      leaderName: user.fullName,
      members: [
        {
          id: user.id,
          name: user.fullName,
          role: 'Капитан',
          competencies: user.studentProfile?.skills || [],
          avatar: user.avatar,
          email: user.email,
        },
      ],
      id: `team_${createId()}`,
      createdAt: new Date().toISOString().split('T')[0],
    }
    this.teams.push(newTeam)
    save('teams', this.teams)
    return newTeam
  }

  // Comments
  deleteComment(id: string): void {
    const user = this.actor()
    const comment = this.comments.find((c) => c.id === id)
    if (!comment || comment.authorId !== user.id)
      throw new Error('Можно удалить только свой комментарий')
    if (this.comments.some((c) => c.parentId === id)) {
      comment.content = 'Комментарий удалён'
      comment.likedBy = []
    } else this.comments = this.comments.filter((c) => c.id !== id)
    save('comments', this.comments)
  }
  getComments(caseId: string): ProjectComment[] {
    return this.comments
      .filter((c) => c.caseId === caseId)
      .map((comment) => {
        const author = this.users.find((user) => user.id === comment.authorId)
        return {
          ...comment,
          authorName: author?.fullName || comment.authorName,
          authorAvatar: author ? author.avatar : comment.authorAvatar,
        }
      })
  }

  addComment(data: Omit<ProjectComment, 'id' | 'createdAt'>): ProjectComment {
    const user = this.actor()
    if (!data.content.trim() || !this.getCaseById(data.caseId))
      throw new Error('Комментарий пуст или кейс недоступен')
    if (
      data.parentId &&
      !this.comments.some((c) => c.id === data.parentId && c.caseId === data.caseId)
    )
      throw new Error('Исходный комментарий не найден')
    const comment: ProjectComment = {
      ...data,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      authorAvatar: user.avatar,
      likedBy: [],
      id: `comm_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    this.comments.push(comment)
    save('comments', this.comments)
    return comment
  }

  // Notifications
  getNotifications(userId: string): SystemNotification[] {
    this.notifications
      .filter((n) => n.type === 'company_invite' && !n.invitation)
      .forEach((n) => {
        const project = this.cases.find((c) => n.link === `/cases/${c.id}`)
        const sender = this.users.find((u) => u.companyProfile?.companyId === project?.companyId)
        if (project && sender) {
          n.invitation = {
            caseId: project.id,
            companyId: project.companyId,
            senderId: sender.id,
            senderName: sender.fullName,
            reason: 'Приглашение к участию',
            status: 'pending',
            replies: [],
          }
          n.link = `/invitations/${n.id}`
        }
      })
    save('notifications', this.notifications)
    return this.notifications.filter((n) => n.userId === userId || n.userId === 'all')
  }

  markNotificationRead(id: string): void {
    const n = this.notifications.find((x) => x.id === id)
    if (n) {
      n.read = true
      save('notifications', this.notifications)
    }
  }

  markAllNotificationsRead(userId: string): void {
    this.notifications.forEach((n) => {
      if (n.userId === userId || n.userId === 'all') n.read = true
    })
    save('notifications', this.notifications)
  }

  // Audit Logs
  getAuditLogs(): AuditLog[] {
    return this.auditLogs
  }

  logAudit(data: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const log: AuditLog = {
      ...data,
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    }
    this.auditLogs.unshift(log)
    save('auditLogs', this.auditLogs)
  }

  // Students catalog search
  getStudents(filters?: {
    search?: string
    institute?: string
    course?: number
    skill?: string
    direction?: string
    minRating?: number
  }): User[] {
    let list = this.users.filter((u) => u.role === 'student')
    filters ||= {}

    if (filters.search) {
      list = list.filter((u) =>
        matchesSearch(
          filters.search!,
          u.fullName,
          u.studentProfile?.group,
          u.studentProfile?.fieldOfStudy,
          u.studentProfile?.skills,
          u.studentProfile?.techStack,
        ),
      )
    }
    if (filters.institute && filters.institute !== 'all') {
      list = list.filter((u) => u.studentProfile?.institute === filters.institute)
    }
    if (filters.course) {
      list = list.filter((u) => u.studentProfile?.course === Number(filters.course))
    }
    if (filters.skill) {
      const sk = filters.skill.toLowerCase()
      list = list.filter((u) => u.studentProfile?.skills.some((s) => s.toLowerCase().includes(sk)))
    }
    if (filters.minRating) {
      list = list.filter((u) => (u.studentProfile?.rating || 0) >= filters.minRating!)
    }

    return list
  }

  inviteStudent(studentId: string, caseId: string, type: string, message: string): void {
    if (this.sessionUser()?.role !== 'company')
      throw new Error('Приглашать студентов может только компания')
    this.requireCaseManager(caseId)
    const c = this.cases.find((x) => x.id === caseId)
    const notificationId = createId()
    const sender = this.actor()
    this.notifications.unshift({
      id: notificationId,
      userId: studentId,
      type: 'company_invite',
      title: `Приглашение от компании: ${c?.companyName || 'Партнер УУНиТ'}`,
      message: `Вас приглашают в проект «${c?.title || 'Кейс'}» (${type}). Сообщение: ${message}`,
      read: false,
      link: `/invitations/${notificationId}`,
      invitation: {
        caseId,
        senderId: sender.id,
        senderName: sender.fullName,
        companyId: c?.companyId,
        reason: type,
        status: 'pending',
        replies: [],
      },
      createdAt: new Date().toISOString(),
    })
    save('notifications', this.notifications)
  }
}

// Match a JSON API boundary: neither requests nor responses share mutable objects
// with Redux. Otherwise a later mock write mutates previously delivered state.
export const createMockServer = (): MockServer =>
  new Proxy(new MockServer(), {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) =>
        structuredClone(Reflect.apply(value, target, structuredClone(args)))
    },
  })

let lazyMock: MockServer | undefined
export const mockServer = new Proxy({} as MockServer, {
  get(_target, key) {
    return (...args: unknown[]) => {
      lazyMock ||= createMockServer()
      return Reflect.apply((lazyMock as any)[key], lazyMock, args)
    }
  },
})
