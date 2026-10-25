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
import { canModerate, isPublished, publicationLabels, visibleStudentProjectsFor } from '../utils/publication'

// Keys for localStorage
const STORAGE_PREFIX = 'uust_showcase_v2_'
const load = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(fallback))
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const save = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
  } catch (e) {
    console.error('Storage save error:', e)
  }
}

export class MockServer {
  private notifyReviewers(kind: 'case' | 'student', title: string): void {
    this.users.filter(canModerate).forEach((user) => this.notifications.unshift({
      id: `review_${Date.now()}_${kind}_${user.id}`, userId: user.id, type: 'publication_status',
      title: 'Новая публикация на рассмотрении', message: title, read: false,
      link: kind === 'case' ? '/companies?review=cases' : '/student-projects?review=student', createdAt: new Date().toISOString(),
    }))
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
    if (!project || !canManageCase(this.sessionUser(), project)) throw new Error('Нет прав на изменение этого кейса')
    return project
  }

  private requireAdmin(): void {
    if (this.sessionUser()?.role !== 'admin') throw new Error('Действие доступно только администратору')
  }
  private users: User[] = load('users', INITIAL_USERS)
  private companies: Company[] = load('companies', INITIAL_COMPANIES)
  private cases: CaseProject[] = load('cases', INITIAL_CASES)
  private milestones: ProjectMilestone[] = load('milestones', INITIAL_MILESTONES)
  private submissions: ProjectSubmission[] = load('submissions', INITIAL_SUBMISSIONS)
  private evaluations: ProjectEvaluation[] = load('evaluations', INITIAL_EVALUATIONS)
  private studentProjects: StudentProject[] = load('studentProjects', INITIAL_STUDENT_PROJECTS)
  private applications: CaseApplication[] = load('applications', INITIAL_APPLICATIONS)
  private teams: ProjectTeam[] = load('teams', INITIAL_TEAMS)
  private comments: ProjectComment[] = load('comments', INITIAL_COMMENTS)
  private notifications: SystemNotification[] = load('notifications', INITIAL_NOTIFICATIONS)
  private auditLogs: AuditLog[] = load('auditLogs', INITIAL_AUDIT_LOGS)
  private favorites: string[] = load('favorites', ['case_1', 'case_2'])
  private ndaAccepted: string[] = load('ndaAccepted', [])

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

  toggleUserBlock(userId: string): User {
    this.requireAdmin()
    const user = this.users.find((u) => u.id === userId)
    if (user) {
      user.isBlocked = !user.isBlocked
      save('users', this.users)
      this.logAudit({
        userId: 'usr_admin_1',
        userName: 'Наиль Хисамов',
        userRole: 'admin',
        actionType: 'user_blocked',
        objectType: 'User',
        objectId: user.id,
        objectName: user.fullName,
        previousValue: user.isBlocked ? 'Разблокирован' : 'Заблокирован',
        newValue: user.isBlocked ? 'Заблокирован' : 'Разблокирован',
        details: `Статус пользователя изменен`,
      })
    }
    return user!
  }

  changeUserRole(userId: string, newRole: User['role']): User {
    this.requireAdmin()
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
    companyName?: string
  }): User {
    const existing = this.users.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase() || u.username.toLowerCase() === data.username.toLowerCase()
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
      phone: data.phone || '+7 (900) 000-00-00',
      createdAt: new Date().toISOString(),
      avatar:
        data.role === 'student'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    }

    if (data.role === 'student') {
      newUser.studentProfile = {
        university: 'Уфимский университет науки и технологий (УУНиТ)',
        institute: data.institute || 'Институт информатики, математики и робототехники',
        fieldOfStudy: '09.03.04 Программная инженерия',
        educationalProgram: 'Разработка программно-информационных систем',
        course: 1,
        group: data.group || 'ПИ-101',
        bio: 'Студент УУНиТ. Изучаю современные информационные технологии и разработку ПО.',
        interests: ['Веб-разработка', 'Алгоритмы', 'Информационные системы'],
        skills: ['React', 'TypeScript', 'Git', 'Python'],
        techStack: ['React', 'TypeScript'],
        githubUrl: 'https://github.com/uust-student',
        phone: data.phone || '',
        rating: 85,
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
        logo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120',
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
    return this.companies
  }

  getCompanyById(id: string): Company | undefined {
    return this.companies.find((c) => c.id === id)
  }

  updateCompany(updated: Company): Company {
    this.companies = this.companies.map((c) => (c.id === updated.id ? updated : c))
    save('companies', this.companies)
    return updated
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
      const s = filters.search.trim().toLowerCase()
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(s) ||
          c.shortDescription.toLowerCase().includes(s) ||
          c.companyName.toLowerCase().includes(s) ||
          [...c.requiredCompetencies, ...c.recommendedTech].some((tech) => tech.toLowerCase().includes(s))
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
        (c) => c.participationFormat === filters.participationFormat || c.participationFormat === 'both'
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

  createCase(caseData: Omit<CaseProject, 'id' | 'viewsCount' | 'applicationsCount' | 'publishedAt'>): CaseProject {
    const user = this.sessionUser()
    if (!user || (user.role !== 'admin' && (user.role !== 'company' || user.companyProfile?.companyId !== caseData.companyId))) {
      throw new Error('Нет прав на публикацию кейса от этой компании')
    }
    if (user.role === 'company' && !this.companies.find((company) => company.id === caseData.companyId)?.isVerified) {
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
    const prev = this.cases.find((c) => c.id === updated.id)
    if (this.sessionUser()?.role === 'company') {
      updated = { ...updated, companyId: prev!.companyId, isModerated: prev!.isModerated, moderationStatus: prev!.moderationStatus }
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
    if (user?.role === 'company') result = result.filter((a) => a.companyId === user.companyProfile?.companyId)
    if (user?.role === 'student') result = result.filter((a) => a.studentId === user.id)
    if (caseId) result = result.filter((a) => a.caseId === caseId)
    if (studentId) result = result.filter((a) => a.studentId === studentId)
    return result
  }

  createApplication(data: Omit<CaseApplication, 'id' | 'createdAt' | 'status'>): CaseApplication {
    const user = this.sessionUser()
    const project = this.cases.find((item) => item.id === data.caseId)
    if (!user || user.role !== 'student' || data.studentId !== user.id) throw new Error('Заявку может подать только студент от своего имени')
    if (!project || !isPublished(project) || !['open', 'application', 'selection'].includes(project.status)) throw new Error('Кейс не открыт для заявок')
    if (project.companyId !== data.companyId) throw new Error('Компания не соответствует кейсу')
    if (this.applications.some((app) => app.caseId === data.caseId && app.studentId === user.id)) throw new Error('Вы уже подали заявку')
    const newApp: CaseApplication = {
      ...data,
      id: `app_${Date.now()}`,
      status: 'pending',
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

  updateApplicationStatus(appId: string, status: CaseApplication['status'], notes?: string): CaseApplication {
    const app = this.applications.find((a) => a.id === appId)
    if (!app) throw new Error('Заявка не найдена')
    this.requireCaseManager(app.caseId)
    if (app.status === 'accepted' && status === 'interview') throw new Error('Студент уже принят в команду')
    if (['accepted', 'rejected'].includes(app.status)) throw new Error('Решение по заявке уже принято')
    if (app) {
      const prev = app.status
      app.status = status
      if (notes) app.companyNotes = notes
      save('applications', this.applications)

      // If accepted, update case status to in_progress
      if (status === 'accepted') {
        const c = this.cases.find((x) => x.id === app.caseId)
        if (c) {
          c.status = 'in_progress'
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

  submitMilestone(milestoneId: string, materials: { name: string; url: string; size?: string }[]): ProjectMilestone {
    const m = this.milestones.find((x) => x.id === milestoneId)
    const user = this.sessionUser()
    const project = this.cases.find((c) => c.id === m?.caseId)
    if (!user || user.role !== 'student' || !project || !participatesInCase(user.id, project, this.teams)) throw new Error('Материалы может сдавать только участник проекта')
    if (m) {
      m.status = 'submitted'
      m.submittedAt = new Date().toISOString().split('T')[0]
      m.attachedMaterials = [...m.attachedMaterials, ...materials]
      save('milestones', this.milestones)
    }
    return m!
  }

  updateMilestoneStatus(milestoneId: string, status: ProjectMilestone['status'], feedback?: string): ProjectMilestone {
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

  createMilestone(caseId: string, data: { title: string; description: string; deadline: string }): ProjectMilestone {
    this.requireCaseManager(caseId)
    if (!data.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(data.deadline)) throw new Error('Укажите название и срок этапа')
    const milestone: ProjectMilestone = {
      ...data, title: data.title.trim(), id: `milestone_${crypto.randomUUID()}`, caseId,
      stepNumber: this.getMilestones(caseId).length + 1, status: 'pending', attachedMaterials: [],
    }
    this.milestones.push(milestone)
    save('milestones', this.milestones)
    return milestone
  }

  deleteMilestone(milestoneId: string): void {
    const milestone = this.milestones.find((m) => m.id === milestoneId)
    if (!milestone) throw new Error('Контрольная точка не найдена')
    this.requireCaseManager(milestone.caseId)
    this.milestones = this.milestones.filter((m) => m.id !== milestoneId)
    this.milestones.filter((m) => m.caseId === milestone.caseId).forEach((m, index) => { m.stepNumber = index + 1 })
    save('milestones', this.milestones)
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
    if (!this.getSubmission(data.caseId)) throw new Error('Сначала необходимо представить результат проекта')
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
  getStudentProjects(filters?: { search?: string; category?: string; direction?: string; badge?: string }): StudentProject[] {
    let list = visibleStudentProjectsFor(this.sessionUser(), this.studentProjects)
    if (!filters) return list

    if (filters.search) {
      const s = filters.search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(s) ||
          p.shortDescription.toLowerCase().includes(s) ||
          p.authorName.toLowerCase().includes(s) ||
          p.technologies.some((t) => t.toLowerCase().includes(s))
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

    return list
  }

  getStudentProjectById(id: string): StudentProject | undefined {
    return visibleStudentProjectsFor(this.sessionUser(), this.studentProjects).find((p) => p.id === id)
  }

  createStudentProject(data: Omit<StudentProject, 'id' | 'createdAt' | 'likesCount' | 'isModerated'>): StudentProject {
    const user = this.sessionUser()
    if (!user || user.role !== 'student' || data.authorId !== user.id) throw new Error('Публиковать проект может только его автор-студент')
    const newProj: StudentProject = {
      ...data,
      id: `sp_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      likesCount: 0,
      isModerated: false,
      moderationStatus: 'pending',
    }
    this.studentProjects.unshift(newProj)
    save('studentProjects', this.studentProjects)
    this.notifyReviewers('student', newProj.title)
    return newProj
  }

  toggleStudentProjectLike(id: string): StudentProject {
    const p = this.studentProjects.find((x) => x.id === id)
    if (p) {
      p.likesCount += 1
      save('studentProjects', this.studentProjects)
    }
    return p!
  }

  moderatePublication(kind: 'case' | 'student', id: string, status: ModerationStatus, comment = ''): CaseProject | StudentProject {
    const user = this.sessionUser()
    if (!canModerate(user)) throw new Error('Нет прав на модерацию публикаций')
    if (status !== 'approved' && !comment.trim()) throw new Error('Укажите причину решения')
    const collection = kind === 'case' ? this.cases : this.studentProjects
    const project = collection.find((item) => item.id === id)
    if (!project) throw new Error('Публикация не найдена')
    const previous = project.moderationStatus || (project.isModerated ? 'approved' : 'pending')
    const updated = { ...project, moderationStatus: status, moderationComment: comment.trim(), isModerated: status === 'approved' }
    if (kind === 'case') {
      const caseItem = updated as CaseProject
      if (status === 'approved' && caseItem.status === 'moderation') {
        caseItem.status = 'open'
        caseItem.publishedAt = new Date().toISOString().split('T')[0]
      }
      this.cases = this.cases.map((item) => item.id === id ? caseItem : item)
      save('cases', this.cases)
    } else {
      this.studentProjects = this.studentProjects.map((item) => item.id === id ? updated as StudentProject : item)
      save('studentProjects', this.studentProjects)
    }
    this.logAudit({ userId: user!.id, userName: user!.fullName, userRole: user!.role,
      actionType: 'moderation_action', objectType: kind === 'case' ? 'CaseProject' : 'StudentProject',
      objectId: id, objectName: project.title, previousValue: previous, newValue: status, details: comment.trim() })
    const recipientIds = kind === 'student' ? [(project as StudentProject).authorId]
      : this.users.filter((item) => item.companyProfile?.companyId === (project as CaseProject).companyId).map((item) => item.id)
    recipientIds.forEach((userId) => this.notifications.unshift({
      id: `notification_${Date.now()}_${userId}`, userId, type: 'publication_status',
      title: `Публикация: ${publicationLabels[status]}`, message: `${project.title}${comment ? `. ${comment.trim()}` : ''}`,
      read: false, link: kind === 'case' ? `/cases/${id}` : `/student-projects/${id}`, createdAt: new Date().toISOString(),
    }))
    save('notifications', this.notifications)
    return updated as CaseProject | StudentProject
  }

  // Teams
  getTeams(): ProjectTeam[] {
    return this.teams
  }

  createTeam(data: Omit<ProjectTeam, 'id' | 'createdAt'>): ProjectTeam {
    const newTeam: ProjectTeam = {
      ...data,
      id: `team_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    }
    this.teams.push(newTeam)
    save('teams', this.teams)
    return newTeam
  }

  // Comments
  getComments(caseId: string): ProjectComment[] {
    return this.comments.filter((c) => c.caseId === caseId)
  }

  addComment(data: Omit<ProjectComment, 'id' | 'createdAt'>): ProjectComment {
    const comment: ProjectComment = {
      ...data,
      id: `comm_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    this.comments.push(comment)
    save('comments', this.comments)
    return comment
  }

  // Notifications
  getNotifications(userId: string): SystemNotification[] {
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
    if (!filters) return list

    if (filters.search) {
      const s = filters.search.trim().toLowerCase()
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(s) ||
          u.studentProfile?.fieldOfStudy.toLowerCase().includes(s) ||
          u.studentProfile?.skills.some((sk) => sk.toLowerCase().includes(s)) ||
          u.studentProfile?.techStack.some((ts) => ts.toLowerCase().includes(s))
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
    if (this.sessionUser()?.role !== 'company') throw new Error('Приглашать студентов может только компания')
    this.requireCaseManager(caseId)
    const c = this.cases.find((x) => x.id === caseId)
    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: studentId,
      type: 'company_invite',
      title: `Приглашение от компании: ${c?.companyName || 'Партнер УУНиТ'}`,
      message: `Вас приглашают в проект «${c?.title || 'Кейс'}» (${type}). Сообщение: ${message}`,
      read: false,
      link: `/cases/${caseId}`,
      createdAt: new Date().toISOString(),
    })
    save('notifications', this.notifications)
  }
}

// Match a JSON API boundary: neither requests nor responses share mutable objects
// with Redux. Otherwise a later mock write mutates previously delivered state.
export const createMockServer = (): MockServer => new Proxy(new MockServer(), {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver)
    if (typeof value !== 'function') return value
    return (...args: unknown[]) => structuredClone(Reflect.apply(value, target, structuredClone(args)))
  },
})

export const mockServer = createMockServer()
