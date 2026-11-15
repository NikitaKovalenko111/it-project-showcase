import {
  fromUser,
  fromCase,
  fromCompany,
  toCase,
  collectPages,
  collectNumbered,
  fromApplication,
  fromTeam,
  fromComment,
  fromStudent,
  fromProject,
  fromStage,
} from './backend'
import { getProjectCatalog, projectCategoryCode } from './studentProjectCatalog'
import { apiRuntime, tokenStore } from './runtime'
import { mockServer } from './mockServer'
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

export { axiosInstance } from './http'
import { axiosInstance } from './http'
// Simulated delay helper for realistic network feedback
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms))

async function resolveCaseCatalogs(project: CaseProject) {
  const payload = toCase(project)
  const [directions, competencies] = await Promise.all(
    ['directions', 'competencies'].map((name) => axiosInstance.get(`/catalogs/${name}`)),
  )
  const find = (items: any[], name: string) =>
    items.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())?.id
  if (project.direction) {
    const id = find(directions.data.items || [], project.direction)
    if (!id) throw new Error(`Направление «${project.direction}» отсутствует в справочнике сервера`)
    if (payload.direction_ids[0] !== id) payload.direction_ids = [id]
  } else {
    payload.direction_ids = []
  }
  payload.required_competencies = project.requiredCompetencies.map((name) => {
    const id = find(competencies.data.items || [], name)
    if (!id) throw new Error(`Компетенция «${name}» отсутствует в справочнике сервера`)
    return {
      id,
      required_level:
        payload.required_competencies.find((item: any) => item.id === id)?.required_level || '',
    }
  })
  return payload
}

export const apiClient = {
  async moderatePublication(
    kind: 'case' | 'student',
    id: string,
    status: ModerationStatus,
    comment: string,
  ): Promise<CaseProject | StudentProject> {
    if (apiRuntime.mode === 'live') {
      const resource = kind === 'case' ? 'cases' : 'student-projects'
      const payload =
        kind === 'case'
          ? {
              decision: (
                {
                  approved: 'approve',
                  rejected: 'reject',
                  revision: 'request_revision',
                  hidden: 'hide',
                  pending: 'request_revision',
                } as const
              )[status],
              comment,
            }
          : {
              status:
                status === 'approved' ? 'published' : status === 'hidden' ? 'hidden' : 'revision',
              comment,
            }
      const res = await axiosInstance.patch(`/${resource}/${id}/moderation`, payload)
      if (kind === 'case') return fromCase(res.data)
      const catalog = await getProjectCatalog().catch(() => undefined)
      return fromProject(res.data, catalog)
    }
    await delay(180)
    return mockServer.moderatePublication(kind, id, status, comment)
  },
  // Auth & Users
  async getCurrentUser(): Promise<User> {
    if (apiRuntime.mode === 'live') {
      if (!tokenStore.get() && !localStorage.getItem('uust_refresh_token'))
        throw new Error('Требуется вход в систему')
      const res = await axiosInstance.get('/auth/me')
      const user = fromUser(res.data)
      if (user.role === 'company') {
        const company = (await axiosInstance.get('/companies/mine')).data.items?.[0]
        if (company)
          user.companyProfile = {
            companyId: company.company_id,
            companyName: company.full_name,
            position: '',
          }
      }
      localStorage.setItem('uust_current_user', JSON.stringify(user))
      return user
    }
    await delay(100)
    const stored = localStorage.getItem('uust_current_user')
    if (!stored) throw new Error('Войдите в аккаунт')
    const { id } = JSON.parse(stored) as User
    const user = mockServer.getUserById(id)
    if (!user || user.isBlocked) throw new Error('Аккаунт недоступен')
    return user
  },

  async login(username: string, password = ''): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<{
        user_id: string
        access_token: string
        refresh_token: string
        token_type: string
      }>('/auth/login', { login: username, password })
      tokenStore.set(res.data.access_token)
      localStorage.setItem('uust_refresh_token', res.data.refresh_token)
      localStorage.removeItem('uust_logged_out')
      return apiClient.getCurrentUser()
    }
    await delay(200)
    const user = mockServer.getUsers().find((u) => u.username === username || u.email === username)
    if (!user)
      throw new Error('Пользователь не найден. Проверьте логин или используйте демо-аккаунт.')
    if (user.isBlocked) throw new Error('Данный аккаунт заблокирован администратором.')
    tokenStore.set(`token_${user.id}`)
    localStorage.removeItem('uust_logged_out')
    localStorage.setItem('uust_current_user', JSON.stringify(user))
    mockServer.logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'auth_login',
      objectType: 'User',
      objectId: user.id,
      objectName: user.fullName,
      details: 'Успешный вход в систему',
    })
    return user
  },

  async requestRole(data: {
    username: string
    email: string
    password: string
    role: 'company' | 'curator'
  }): Promise<void> {
    await axiosInstance.post('/auth/register', {
      username: data.username,
      email: data.email,
      password: data.password,
      role: data.role === 'company' ? 'company_representative' : 'university_staff',
      consent_version: '1',
    })
  },

  async reviewRoleRequest(userId: string, status: 'approved' | 'rejected'): Promise<void> {
    await axiosInstance.patch(`/users/${userId}/role-request`, { status })
  },

  async register(data: any): Promise<User> {
    if (apiRuntime.mode === 'live') {
      if (data.role && data.role !== 'student')
        throw new Error(
          'Публичная регистрация доступна студентам. Аккаунт компании создаёт администратор.',
        )
      const [last_name, first_name, ...rest] = (data.fullName || '').trim().split(/\s+/)
      const registration = {
        username: data.username,
        email: data.email,
        password: data.password,
        last_name,
        first_name,
        patronymic: rest.join(' '),
        institute: data.institute,
        direction: data.direction || '',
        course: Number(data.course || 1),
        group_name: data.group || '',
        phone: data.phone || '',
        technologies: data.technologies || [],
        consent_version: '1',
      }
      const res = await axiosInstance.post<{ access_token?: string; refresh_token?: string }>(
        '/auth/register',
        registration,
      )
      if (!res.data.access_token) return apiClient.login(data.username || data.email, data.password)
      tokenStore.set(res.data.access_token)
      if (res.data.refresh_token) localStorage.setItem('uust_refresh_token', res.data.refresh_token)
      return apiClient.getCurrentUser()
    }
    await delay(250)
    const user = mockServer.registerUser(data)
    tokenStore.set(`token_${user.id}`)
    localStorage.removeItem('uust_logged_out')
    localStorage.setItem('uust_current_user', JSON.stringify(user))
    return user
  },

  async logout(): Promise<void> {
    try {
      if (apiRuntime.mode === 'live')
        await axiosInstance.post('/auth/logout', {
          refresh_token: localStorage.getItem('uust_refresh_token'),
        })
    } finally {
      tokenStore.clear()
      localStorage.removeItem('uust_current_user')
      localStorage.setItem('uust_logged_out', 'true')
    }
    await delay(100)
  },

  async getUsers(): Promise<User[]> {
    if (apiRuntime.mode === 'live') {
      return (await collectNumbered<any>((params) => axiosInstance.get('/users', { params }))).map(
        fromUser,
      )
    }
    await delay(120)
    return mockServer.getUsers()
  },

  async updateAvatar(user: User, file: File): Promise<User> {
    let avatar: string
    if (apiRuntime.mode === 'live') {
      if (user.role !== 'student') throw new Error('Загрузка аватара доступна студентам.')
      const body = new FormData()
      body.append('file', file)
      const { data } = await axiosInstance.put('/users/me/photo', body)
      avatar = `${apiRuntime.baseUrl || '/api/v1'}/students/${user.id}/photo?v=${data.file_id}`
    } else {
      avatar = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'))
        reader.readAsDataURL(file)
      })
      mockServer.updateUser({ ...user, avatar })
    }
    const updated = { ...user, avatar }
    localStorage.setItem('uust_current_user', JSON.stringify(updated))
    return updated
  },

  async getResume(): Promise<NonNullable<User['studentProfile']>['resume']> {
    const user = JSON.parse(localStorage.getItem('uust_current_user') || 'null') as User | null
    if (apiRuntime.mode === 'mock')
      return user ? mockServer.getUserById(user.id)?.studentProfile?.resume : undefined
    const files = (await axiosInstance.get('/portfolio/me/files')).data.items || []
    const resume =
      files.find((f: any) => f.kind === 'resume' && f.is_default) ||
      files.find((f: any) => f.kind === 'resume')
    return resume
      ? {
          name: resume.original_name,
          file_id: resume.file_id,
          url: `${apiRuntime.baseUrl || '/api/v1'}/files/${resume.file_id}`,
          size: `${Math.ceil(resume.size_bytes / 1024)} КБ`,
          public: resume.visibility === 'public',
        }
      : undefined
  },
  async saveResume(
    file: NonNullable<NonNullable<User['studentProfile']>['resume']>,
  ): Promise<void> {
    if (apiRuntime.mode === 'live') {
      if (!file.file_id) throw new Error('Сначала загрузите файл резюме')
      await axiosInstance.post('/portfolio/me/files', {
        file_id: file.file_id,
        kind: 'resume',
        visibility: file.public ? 'public' : 'private',
        is_default: true,
      })
      return
    }
    const stored = JSON.parse(localStorage.getItem('uust_current_user') || 'null') as User | null
    const user = stored ? mockServer.getUserById(stored.id) : undefined
    if (!user?.studentProfile) throw new Error('Войдите под аккаунтом студента')
    const updated = mockServer.updateUser({
      ...user,
      studentProfile: { ...user.studentProfile, resume: file },
    })
    localStorage.setItem('uust_current_user', JSON.stringify(updated))
  },
  async updateUser(user: User): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const profile = user.studentProfile
      if (user.role !== 'student' || !profile)
        throw new Error('Редактирование доступно для профиля студента')
      const [last_name, first_name, ...rest] = user.fullName.trim().split(/\s+/)
      const links = [
        ...new Map([
          ...(profile.links || [])
            .filter((link) => !['github', 'gitlab', 'portfolio'].includes(link.kind))
            .map((link) => [link.kind, link] as const),
          ...(
            [
              ['github', profile.githubUrl],
              ['gitlab', profile.gitlabUrl],
              ['portfolio', profile.portfolioUrl],
            ] as const
          )
            .filter(([, url]) => !!url)
            .map(([kind, url]) => [kind, { kind, url: url! }] as const),
        ]).values(),
      ]
      await axiosInstance.put('/students/me/profile', {
        email: user.email,
        last_name,
        first_name,
        patronymic: rest.join(' '),
        phone: profile.phone,
        institute: profile.institute,
        direction: profile.fieldOfStudy,
        program: profile.educationalProgram,
        course: profile.course,
        group_name: profile.group,
        bio: profile.bio,
        education_level: profile.educationLevel,
        professional_interests: profile.interests,
        competencies: profile.skills,
        technologies: profile.techStack,
        links,
      })
      return apiClient.getCurrentUser()
    }
    await delay(150)
    const fresh = mockServer.getUserById(user.id)
    const updated = mockServer.updateUser(
      user.studentProfile
        ? {
            ...user,
            studentProfile: { ...user.studentProfile, resume: fresh?.studentProfile?.resume },
          }
        : user,
    )
    const current = localStorage.getItem('uust_current_user')
    if (current && JSON.parse(current).id === user.id) {
      localStorage.setItem('uust_current_user', JSON.stringify(updated))
    }
    return updated
  },

  async setUserBlock(user: User, blocked: boolean, reason = ''): Promise<User> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.patch(`/users/${user.id}/status`, {
        status: blocked ? 'blocked' : 'active',
      })
      return { ...user, isBlocked: blocked }
    }
    const current = mockServer.getUserById(user.id)
    if (!current) throw new Error('Пользователь не найден')
    return !!current.isBlocked === blocked ? current : mockServer.toggleUserBlock(user.id, reason)
  },

  async changeUserRole(userId: string, role: User['role']): Promise<User> {
    if (apiRuntime.mode === 'live') {
      throw new Error('Сервер пока не предоставляет смену роли пользователя')
    }
    await delay(120)
    return mockServer.changeUserRole(userId, role)
  },

  // Cases
  async getCases(filters?: any): Promise<CaseProject[]> {
    if (apiRuntime.mode === 'live') {
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      const rows = await collectPages<any>((params) => axiosInstance.get('/cases', { params }), {
        search: filters?.search,
        company_id: filters?.companyId,
      })
      const managed = new Set<string>()
      if (actor?.role === 'company') {
        const own = await collectPages<any>((params) =>
          axiosInstance.get('/cases/mine', { params }),
        )
        own.forEach((row) => managed.add(row.case_id))
        rows.push(...own)
      }
      if (['admin', 'curator', 'university'].includes(actor?.role))
        rows.push(
          ...(await collectPages<any>((params) =>
            axiosInstance.get('/cases/moderation', { params }),
          )),
        )
      return [...new Map(rows.map((d) => [d.case_id, d])).values()].map((row) => ({
        ...fromCase(row),
        managedByViewer: actor?.role === 'company' ? managed.has(row.case_id) : undefined,
      }))
    }
    await delay(150)
    return mockServer.getCases(filters)
  },

  async getCaseById(id: string): Promise<CaseProject> {
    if (apiRuntime.mode === 'live') {
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      if (['admin', 'company'].includes(actor?.role)) {
        try {
          return {
            ...fromCase((await axiosInstance.get(`/cases/${id}/manage`)).data),
            managedByViewer: true,
          }
        } catch (e) {
          if (![403, 404].includes((e as any).status)) throw e
        }
      }
      if (['curator', 'university'].includes(actor?.role)) {
        try {
          return fromCase((await axiosInstance.get(`/cases/${id}/review`)).data)
        } catch (e) {
          if ((e as { status?: number }).status !== 404) throw e
        }
      }
      return { ...fromCase((await axiosInstance.get(`/cases/${id}`)).data), managedByViewer: false }
    }
    await delay(120)
    const c = mockServer.getCaseById(id)
    if (!c) throw new Error('Кейс не найден')
    return c
  },

  async createCase(
    data: Omit<CaseProject, 'id' | 'viewsCount' | 'applicationsCount' | 'publishedAt'>,
    submit = true,
  ): Promise<CaseProject> {
    if (apiRuntime.mode === 'live') {
      if (data.kind === 'internship')
        throw new Error('Стажировки размещаются в разделе «Витрина стажировок».')
      const payload = await resolveCaseCatalogs({
        ...data,
        id: '',
        viewsCount: 0,
        applicationsCount: 0,
        publishedAt: '',
      })
      const { data: created } = await axiosInstance.post('/cases', payload)
      if (data.coverFileId)
        await axiosInstance.put(`/cases/${created.case_id}/cover`, { file_id: data.coverFileId })
      if (submit) return apiClient.submitCase(created.case_id)
      return apiClient.getCaseById(created.case_id)
    }
    await delay(200)
    return mockServer.createCase(data)
  },

  async withdrawCaseModeration(id: string): Promise<CaseProject> {
    if (apiRuntime.mode === 'live')
      throw new Error('Сервер пока не поддерживает отзыв кейса с модерации.')
    return mockServer.withdrawCaseModeration(id)
  },

  async submitCase(id: string): Promise<CaseProject> {
    await axiosInstance.post(`/cases/${id}/submit-moderation`)
    return apiClient.getCaseById(id)
  },

  async updateCase(data: CaseProject): Promise<CaseProject> {
    if (apiRuntime.mode === 'live') {
      const payload = await resolveCaseCatalogs(data)
      const { data: updated } = await axiosInstance.put(`/cases/${data.id}`, payload)
      if (data.coverFileId && updated.cover_file_id !== data.coverFileId) {
        await axiosInstance.put(`/cases/${data.id}/cover`, { file_id: data.coverFileId })
        return apiClient.getCaseById(data.id)
      }
      return fromCase(updated)
    }
    await delay(180)
    return mockServer.updateCase(data)
  },

  async deleteCase(id: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.patch(`/cases/${id}/status`, { status: 'cancelled' })
      return
    }
    await delay(150)
    mockServer.deleteCase(id)
  },

  async getFavorites(): Promise<string[]> {
    if (apiRuntime.mode === 'live')
      return (await collectPages<any>((params) => axiosInstance.get('/favorites', { params })))
        .filter((x) => x.resource_type === 'case')
        .map((x) => x.resource_id)
    await delay(80)
    return mockServer.getFavorites()
  },

  async toggleFavorite(caseId: string): Promise<string[]> {
    if (apiRuntime.mode === 'live') {
      const favorites = await apiClient.getFavorites()
      await axiosInstance.request({
        method: favorites.includes(caseId) ? 'DELETE' : 'PUT',
        url: `/favorites/case/${caseId}`,
      })
      return apiClient.getFavorites()
    }
    await delay(100)
    return mockServer.toggleFavorite(caseId)
  },

  async isNDAAccepted(caseId: string, userId: string): Promise<boolean> {
    if (apiRuntime.mode === 'live') {
      const { data } = await axiosInstance.get(`/cases/${caseId}/nda-grants`)
      return (data.items || []).some((g: any) => g.student_id === userId && g.status === 'granted')
    }
    return mockServer.isNDAAccepted(caseId, userId)
  },

  async acceptNDA(caseId: string, userId: string): Promise<boolean> {
    if (apiRuntime.mode === 'live') {
      const { data } = await axiosInstance.get(`/cases/${caseId}/nda`)
      await axiosInstance.post(`/cases/${caseId}/nda-grants`, {
        nda_version_id: data.nda_version_id,
        accepted: true,
      })
      return true
    }
    await delay(150)
    return mockServer.acceptNDA(caseId, userId)
  },

  // Applications
  async getApplications(caseId?: string, studentId?: string): Promise<CaseApplication[]> {
    if (apiRuntime.mode === 'live') {
      const rows = await collectPages<any>(
        (params) => axiosInstance.get('/applications', { params }),
        { case_id: caseId, mine: studentId ? true : undefined },
      )
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      const directory = ['company', 'admin'].includes(actor?.role)
        ? await collectPages<any>((params) => axiosInstance.get('/students/search', { params }))
        : []
      const students = new Map(directory.map((student) => [student.user_id, student]))
      return rows.map((d) => {
        const id = d.student_id || d.submitted_by
        const profile = students.get(id)
        return fromApplication({
          ...d,
          student_name: profile?.full_name || (actor?.id === id ? actor.fullName : 'Участник'),
          student_institute: profile?.institute,
          student_course: profile?.course,
          student_group: profile?.group_name,
          student_avatar: profile?.photo_file_id
            ? `${apiRuntime.baseUrl || '/api/v1'}/students/${id}/photo?v=${profile.photo_file_id}`
            : undefined,
        })
      })
    }
    await delay(150)
    return mockServer.getApplications(caseId, studentId)
  },

  async createApplication(data: any): Promise<CaseApplication> {
    if (apiRuntime.mode === 'live') {
      const { data: created } = await axiosInstance.post(
        data.registration ? '/event-registrations' : '/applications',
        {
          case_id: data.caseId,
          applicant_type: data.applicantType || 'individual',
          team_id: data.teamId || '',
          cover_letter: data.coverLetter,
          resume_file_id: data.resumeFileId || '',
          portfolio_url: data.portfolioUrl || '',
          github_url: data.githubUrl || '',
        },
      )
      return fromApplication(created)
    }
    await delay(250)
    return mockServer.createApplication(data)
  },

  async consentApplication(id: string): Promise<CaseApplication> {
    return fromApplication((await axiosInstance.post(`/applications/${id}/consents`)).data)
  },

  async updateApplicationStatus(
    appId: string,
    status: CaseApplication['status'],
    notes?: string,
  ): Promise<CaseApplication> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.patch<CaseApplication>(`/applications/${appId}/status`, {
        status: status === 'need_info' ? 'info_requested' : status,
        notes,
      })
      return fromApplication(res.data)
    }
    await delay(200)
    return mockServer.updateApplicationStatus(appId, status, notes)
  },

  // Milestones & Workspaces
  async getMilestones(caseId: string): Promise<ProjectMilestone[]> {
    if (apiRuntime.mode === 'live') {
      return ((await axiosInstance.get(`/cases/${caseId}/stages`)).data.items || []).map((d: any) =>
        fromStage(d, caseId),
      )
    }
    await delay(120)
    return mockServer.getMilestones(caseId)
  },

  async submitMilestone(milestoneId: string, materials: any[]): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live') {
      throw new Error('Сдавайте этап в выполнении своей команды: требуется execution_id')
    }
    await delay(200)
    return mockServer.submitMilestone(milestoneId, materials)
  },
  async removeMaterial(milestoneId: string, index: number): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live')
      throw new Error('Удаление файлов сданного этапа не поддерживается сервером')
    return mockServer.removeMaterial(milestoneId, index)
  },

  async updateMilestoneStatus(
    milestoneId: string,
    status: any,
    feedback?: string,
  ): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live') {
      throw new Error('Проверяйте этап внутри выполнения команды: требуется execution_id')
    }
    await delay(150)
    return mockServer.updateMilestoneStatus(milestoneId, status, feedback)
  },

  async createMilestone(
    caseId: string,
    data: { title: string; description: string; deadline: string },
  ): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live') {
      const rows = (await axiosInstance.get(`/cases/${caseId}/stages`)).data.items || []
      return fromStage(
        (
          await axiosInstance.post(`/cases/${caseId}/stages`, {
            ordinal: rows.length + 1,
            title: data.title,
            expected_result: data.description,
            due_at: data.deadline ? `${data.deadline}T23:59:59Z` : null,
          })
        ).data,
        caseId,
      )
    }
    return mockServer.createMilestone(caseId, data)
  },

  async deleteMilestone(milestoneId: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      throw new Error('Удаляйте этап из общего плана: требуется case_id')
    }
    mockServer.deleteMilestone(milestoneId)
  },

  async getSubmission(caseId: string): Promise<ProjectSubmission | undefined> {
    if (apiRuntime.mode === 'live') {
      throw new Error(
        'Результаты хранятся по выполнению команды, а не по кейсу; откройте рабочую страницу проекта',
      )
    }
    await delay(100)
    return mockServer.getSubmission(caseId)
  },

  async createSubmission(data: any): Promise<ProjectSubmission> {
    if (apiRuntime.mode === 'live') {
      throw new Error(
        'Для отправки результата требуется execution_id; используйте рабочую страницу проекта',
      )
    }
    await delay(250)
    return mockServer.createSubmission(data)
  },

  async getEvaluation(caseId: string): Promise<ProjectEvaluation | undefined> {
    if (apiRuntime.mode === 'live') {
      throw new Error('Оценка относится к версии результата; используйте рабочую страницу проекта')
    }
    await delay(100)
    return mockServer.getEvaluation(caseId)
  },

  async createEvaluation(data: any): Promise<ProjectEvaluation> {
    if (apiRuntime.mode === 'live') {
      throw new Error('Для оценки требуется submission_id; используйте рабочую страницу проекта')
    }
    await delay(250)
    return mockServer.createEvaluation(data)
  },

  // Student Projects Showcase
  async getStudentProjects(filters?: any): Promise<StudentProject[]> {
    if (apiRuntime.mode === 'live') {
      const catalog = await getProjectCatalog().catch(() => undefined)
      const direction = catalog?.directions.find((item) => item.name === filters?.direction)
      const rows = await collectPages<any>(
        (params) => axiosInstance.get('/student-projects', { params }),
        {
          search: filters?.search,
          category:
            filters?.category && filters.category !== 'all'
              ? projectCategoryCode(filters.category)
              : undefined,
          direction_id: direction?.id,
        },
      )
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      if (actor?.role === 'student' && !filters)
        rows.push(
          ...(await collectPages<any>((params) =>
            axiosInstance.get('/student-projects/mine', { params }),
          )),
        )
      return [...new Map(rows.map((row) => [row.project_id, row])).values()].map((row) =>
        fromProject(row, catalog),
      )
    }
    await delay(150)
    return mockServer.getStudentProjects(filters)
  },

  async getStudentProjectModeration(): Promise<StudentProject[]> {
    const catalog = await getProjectCatalog().catch(() => undefined)
    const rows = await collectPages<any>((params) =>
      axiosInstance.get('/student-projects/moderation', { params }),
    )
    return rows.map((row) => fromProject(row, catalog))
  },

  async getStudentProjectById(id: string): Promise<StudentProject> {
    if (apiRuntime.mode === 'live') {
      const catalog = await getProjectCatalog().catch(() => undefined)
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      if (['curator', 'university'].includes(actor?.role)) {
        try {
          return fromProject(
            (await axiosInstance.get(`/student-projects/${id}/review`)).data,
            catalog,
          )
        } catch (e) {
          if ((e as { status?: number }).status !== 404) throw e
        }
      }
      return fromProject((await axiosInstance.get(`/student-projects/${id}`)).data, catalog)
    }
    await delay(120)
    const p = mockServer.getStudentProjectById(id)
    if (!p) throw new Error('Проект не найден')
    return p
  },

  async createStudentProject(
    data: Parameters<typeof mockServer.createStudentProject>[0],
  ): Promise<StudentProject> {
    if (apiRuntime.mode === 'live') {
      const catalog = await getProjectCatalog()
      const visibility = data.visibility || 'public'
      const { data: draft } = await axiosInstance.post('/student-projects', {
        title: data.title,
        category: projectCategoryCode(data.category),
        short_description: data.shortDescription,
        full_description: data.fullDescription,
        problem_solved: data.problemSolved || '',
        github_url: data.githubUrl || '',
        product_url: data.productUrl || '',
        visibility,
        tags: [],
        direction_ids: catalog.directions
          .filter((item) => item.name === data.direction)
          .map((item) => item.id),
        technology_ids: catalog.technologies
          .filter((item) => data.technologies.includes(item.name))
          .map((item) => item.id),
      })
      if (visibility === 'private') return fromProject(draft, catalog)
      const result = await axiosInstance.post(
        `/student-projects/${draft.project_id}/submit-moderation`,
      )
      return fromProject(result.data, catalog)
    }
    await delay(220)
    return mockServer.createStudentProject(data)
  },

  async toggleStudentProjectLike(id: string): Promise<StudentProject> {
    if (apiRuntime.mode === 'live') {
      const project = await apiClient.getStudentProjectById(id)
      const { data } = await axiosInstance.request<{ liked: boolean; likes_count: number }>({
        method: project.likedByMe ? 'DELETE' : 'PUT',
        url: `/student-projects/${id}/like`,
      })
      return { ...project, likedByMe: data.liked, likesCount: data.likes_count }
    }
    await delay(100)
    return mockServer.toggleStudentProjectLike(id)
  },

  // Companies
  async getCompanies(): Promise<Company[]> {
    if (apiRuntime.mode === 'live') {
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      const rows = await collectPages<any>((params) => axiosInstance.get('/companies', { params }))
      if (actor?.role === 'company')
        rows.push(
          ...(await collectPages<any>((params) =>
            axiosInstance.get('/companies/mine', { params }),
          )),
        )
      if (actor?.role === 'admin')
        rows.push(
          ...(await collectPages<any>((params) =>
            axiosInstance.get('/companies/moderation', { params }),
          )),
        )
      return [...new Map(rows.map((d) => [d.company_id, d])).values()].map(fromCompany)
    }
    await delay(120)
    return mockServer.getCompanies()
  },

  async getCompanyById(id: string): Promise<Company> {
    if (apiRuntime.mode === 'live') {
      return fromCompany((await axiosInstance.get(`/companies/${id}`)).data)
    }
    await delay(120)
    const c = mockServer.getCompanyById(id)
    if (!c) throw new Error('Компания не найдена')
    return c
  },

  async suspendCompany(id: string): Promise<Company> {
    if (apiRuntime.mode === 'live')
      return fromCompany(
        (
          await axiosInstance.patch(`/companies/${id}/moderation`, {
            status: 'suspended',
            comment: 'Деятельность приостановлена администратором',
          })
        ).data,
      )
    return mockServer.suspendCompany(id)
  },
  async verifyCompany(id: string, status: boolean): Promise<Company> {
    if (apiRuntime.mode === 'live')
      return fromCompany(
        (
          await axiosInstance.patch(`/companies/${id}/moderation`, {
            status: status ? 'approved' : 'rejected',
            comment: '',
          })
        ).data,
      )
    await delay(150)
    return mockServer.verifyCompany(id, status)
  },

  // Students & Teams
  async getStudentById(id: string): Promise<User> {
    if (apiRuntime.mode === 'mock') {
      const user = mockServer.getUserById(id)
      if (!user) throw new Error('Студент не найден')
      return user
    }
    const { data } = await axiosInstance.get(`/students/${id}/portfolio`)
    const user = fromStudent(data.student)
    if (user.studentProfile) {
      user.studentProfile.bio = data.about || ''
      const files = (await axiosInstance.get(`/students/${id}/portfolio/files`)).data.items || []
      const resume = files.find((f: any) => f.kind === 'resume' && f.is_default)
      if (resume) {
        user.studentProfile.resume = {
          name: resume.original_name,
          file_id: resume.file_id,
          url: `${apiRuntime.baseUrl || '/api/v1'}/students/${id}/portfolio/files/${resume.file_id}`,
          public: true,
        }
      }
      user.studentProfile.files = files
        .filter((f: any) => f.kind === 'certificate')
        .map((f: any) => ({
          name: f.original_name,
          file_id: f.file_id,
          url: `${apiRuntime.baseUrl || '/api/v1'}/students/${id}/portfolio/files/${f.file_id}`,
        }))
    }
    return user
  },
  async getStudents(filters?: any): Promise<User[]> {
    if (apiRuntime.mode === 'live') {
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      if (actor?.role === 'student') {
        const profiles = await collectNumbered<any>((params) =>
          axiosInstance.get('/team-search-profiles', { params }),
        )
        const ids = [...new Set([actor.id, ...profiles.map((p) => p.student_id)])]
        const results = await Promise.allSettled(ids.map((id) => apiClient.getStudentById(id)))
        return results
          .filter((r): r is PromiseFulfilledResult<User> => r.status === 'fulfilled')
          .map((r) => r.value)
      }
      return (
        await collectPages<any>((params) => axiosInstance.get('/students/search', { params }), {
          search: filters?.search,
          direction: filters?.direction,
          technology: filters?.technology,
        })
      ).map(fromStudent)
    }
    await delay(150)
    return mockServer.getStudents(filters)
  },

  async inviteStudent(
    studentId: string,
    caseId: string,
    type: string,
    message: string,
  ): Promise<void> {
    if (apiRuntime.mode === 'live') {
      const project = await apiClient.getCaseById(caseId)
      await axiosInstance.post(`/companies/${project.companyId}/student-invitations`, {
        student_id: studentId,
        case_id: caseId,
        kind: type,
        message,
      })
      return
    }
    await delay(180)
    mockServer.inviteStudent(studentId, caseId, type, message)
  },

  async getTeams(): Promise<ProjectTeam[]> {
    if (apiRuntime.mode === 'live') {
      const open = await collectNumbered<any>((params) => axiosInstance.get('/teams', { params }))
      const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
      const mine = actor?.role === 'student' ? await apiClient.getMyTeams() : []
      return [...new Map([...open.map(fromTeam), ...mine].map((team) => [team.id, team])).values()]
    }
    await delay(120)
    return mockServer.getTeams()
  },

  async getMyTeams(): Promise<ProjectTeam[]> {
    return (
      await collectNumbered<any>((params) => axiosInstance.get('/teams/mine', { params }))
    ).map(fromTeam)
  },

  async createTeam(data: any): Promise<ProjectTeam> {
    if (apiRuntime.mode === 'live')
      return fromTeam((await axiosInstance.post('/teams', { name: data.name })).data)
    await delay(200)
    return mockServer.createTeam(data)
  },

  // Comments
  async deleteComment(caseId: string, commentId: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.delete(`/comments/${commentId}`)
      return
    }
    mockServer.deleteComment(commentId)
  },
  async getComments(caseId: string): Promise<ProjectComment[]> {
    if (apiRuntime.mode === 'live') {
      const roots = await collectNumbered<any>((params) =>
        axiosInstance.get(`/cases/${caseId}/comments`, { params }),
      )
      const replies = (
        await Promise.all(
          roots
            .filter((c) => c.reply_count > 0)
            .map((c) =>
              collectNumbered<any>((params) =>
                axiosInstance.get(`/comments/${c.comment_id}/replies`, { params }),
              ),
            ),
        )
      ).flat()
      return [...roots, ...replies].map(fromComment)
    }
    await delay(100)
    return mockServer.getComments(caseId)
  },

  async addComment(data: any): Promise<ProjectComment> {
    if (apiRuntime.mode === 'live')
      return fromComment(
        (
          await axiosInstance.post(
            data.parentId ? `/comments/${data.parentId}/replies` : `/cases/${data.caseId}/comments`,
            { body: data.content },
          )
        ).data,
      )
    await delay(150)
    return mockServer.addComment(data)
  },

  // Notifications
  async getNotifications(userId: string): Promise<SystemNotification[]> {
    if (apiRuntime.mode === 'live')
      return (
        await collectPages<any>((params) => axiosInstance.get('/notifications', { params }))
      ).map((d) => ({
        id: d.notification_id,
        userId,
        type: d.type,
        title: d.title,
        message: d.body,
        read: !!d.read_at,
        createdAt: d.created_at,
        link:
          d.resource_type === 'company_invitation' && d.resource_id
            ? `/invitations/${d.resource_id}`
            : d.resource_type === 'case' && d.resource_id
              ? `/cases/${d.resource_id}`
              : undefined,
      }))
    await delay(100)
    return mockServer.getNotifications(userId)
  },

  async markNotificationRead(id: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.patch(`/notifications/${id}/read`)
      return
    }
    await delay(50)
    mockServer.markNotificationRead(id)
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.post('/notifications/read-all', { userId })
      return
    }
    await delay(80)
    mockServer.markAllNotificationsRead(userId)
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    if (apiRuntime.mode === 'live')
      return (
        await collectNumbered<any>((params) => axiosInstance.get('/audit-logs', { params }))
      ).map((d) => ({
        id: d.audit_id,
        timestamp: d.created_at,
        userId: d.actor_id || '',
        userName: d.actor_id || '',
        userRole: 'admin',
        actionType: d.action,
        objectType: d.entity_type,
        objectId: d.entity_id || '',
        objectName:
          (d.new_data || d.old_data)?.title ||
          (d.new_data || d.old_data)?.full_name ||
          (d.new_data || d.old_data)?.username ||
          '',
        details: d.new_data?.status_reason,
      }))
    await delay(120)
    return mockServer.getAuditLogs()
  },
}
