import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
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

// Axios base client
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: apiRuntime.baseUrl || '/api/v1',
  timeout: apiRuntime.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor to attach JWT token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new Event('uust:unauthorized'))
    }
    return Promise.reject(error)
  }
)

// Simulated delay helper for realistic network feedback
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms))

export const apiClient = {
  async moderatePublication(kind: 'case' | 'student', id: string, status: ModerationStatus, comment: string): Promise<CaseProject | StudentProject> {
    if (apiRuntime.mode === 'live') {
      const resource = kind === 'case' ? 'cases' : 'student-projects'
      const res = await axiosInstance.patch<CaseProject | StudentProject>(`/${resource}/${id}/moderation`, { status, comment })
      return res.data
    }
    await delay(180)
    return mockServer.moderatePublication(kind, id, status, comment)
  },
  // Auth & Users
  async getCurrentUser(): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<User>('/auth/me')
      return res.data
    }
    await delay(100)
    if (localStorage.getItem('uust_logged_out') === 'true') {
      throw new Error('Пользователь вышел из системы')
    }
    const stored = localStorage.getItem('uust_current_user')
    if (stored) {
      const user = JSON.parse(stored) as User
      const fresh = mockServer.getUserById(user.id)
      return fresh || user
    }
    // Default to student Ivan/Almaz if never logged out
    const defaultUser = mockServer.getUserById('usr_student_1')!
    localStorage.setItem('uust_current_user', JSON.stringify(defaultUser))
    return defaultUser
  },

  async login(username: string): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<{ user: User; token: string }>('/auth/login', { username })
      tokenStore.set(res.data.token)
      return res.data.user
    }
    await delay(200)
    const user = mockServer.getUsers().find((u) => u.username === username || u.email === username)
    if (!user) throw new Error('Пользователь не найден. Проверьте логин или используйте демо-аккаунт.')
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

  async register(data: any): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<{ user: User; token: string }>('/auth/register', data)
      tokenStore.set(res.data.token)
      return res.data.user
    }
    await delay(250)
    const user = mockServer.registerUser(data)
    tokenStore.set(`token_${user.id}`)
    localStorage.removeItem('uust_logged_out')
    localStorage.setItem('uust_current_user', JSON.stringify(user))
    return user
  },

  async logout(): Promise<void> {
    tokenStore.clear()
    localStorage.removeItem('uust_current_user')
    localStorage.setItem('uust_logged_out', 'true')
    await delay(100)
  },

  async getUsers(): Promise<User[]> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<User[]>('/users')
      return res.data
    }
    await delay(120)
    return mockServer.getUsers()
  },

  async updateUser(user: User): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.put<User>(`/users/${user.id}`, user)
      return res.data
    }
    await delay(150)
    const updated = mockServer.updateUser(user)
    const current = localStorage.getItem('uust_current_user')
    if (current && JSON.parse(current).id === user.id) {
      localStorage.setItem('uust_current_user', JSON.stringify(updated))
    }
    return updated
  },

  async toggleUserBlock(userId: string): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<User>(`/users/${userId}/toggle-block`)
      return res.data
    }
    await delay(120)
    return mockServer.toggleUserBlock(userId)
  },

  async changeUserRole(userId: string, role: User['role']): Promise<User> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<User>(`/users/${userId}/change-role`, { role })
      return res.data
    }
    await delay(120)
    return mockServer.changeUserRole(userId, role)
  },

  // Cases
  async getCases(filters?: any): Promise<CaseProject[]> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<CaseProject[]>('/cases', { params: filters })
      return res.data
    }
    await delay(150)
    return mockServer.getCases(filters)
  },

  async getCaseById(id: string): Promise<CaseProject> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<CaseProject>(`/cases/${id}`)
      return res.data
    }
    await delay(120)
    const c = mockServer.getCaseById(id)
    if (!c) throw new Error('Кейс не найден')
    return c
  },

  async createCase(data: any): Promise<CaseProject> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<CaseProject>('/cases', data)
      return res.data
    }
    await delay(200)
    return mockServer.createCase(data)
  },

  async updateCase(data: CaseProject): Promise<CaseProject> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.put<CaseProject>(`/cases/${data.id}`, data)
      return res.data
    }
    await delay(180)
    return mockServer.updateCase(data)
  },

  async deleteCase(id: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.delete(`/cases/${id}`)
      return
    }
    await delay(150)
    mockServer.deleteCase(id)
  },

  async getFavorites(): Promise<string[]> {
    await delay(80)
    return mockServer.getFavorites()
  },

  async toggleFavorite(caseId: string): Promise<string[]> {
    await delay(100)
    return mockServer.toggleFavorite(caseId)
  },

  async isNDAAccepted(caseId: string, userId: string): Promise<boolean> {
    return mockServer.isNDAAccepted(caseId, userId)
  },

  async acceptNDA(caseId: string, userId: string): Promise<boolean> {
    await delay(150)
    return mockServer.acceptNDA(caseId, userId)
  },

  // Applications
  async getApplications(caseId?: string, studentId?: string): Promise<CaseApplication[]> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<CaseApplication[]>('/applications', { params: { caseId, studentId } })
      return res.data
    }
    await delay(150)
    return mockServer.getApplications(caseId, studentId)
  },

  async createApplication(data: any): Promise<CaseApplication> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<CaseApplication>('/applications', data)
      return res.data
    }
    await delay(250)
    return mockServer.createApplication(data)
  },

  async updateApplicationStatus(appId: string, status: CaseApplication['status'], notes?: string): Promise<CaseApplication> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.patch<CaseApplication>(`/applications/${appId}/status`, { status, notes })
      return res.data
    }
    await delay(200)
    return mockServer.updateApplicationStatus(appId, status, notes)
  },

  // Milestones & Workspaces
  async getMilestones(caseId: string): Promise<ProjectMilestone[]> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<ProjectMilestone[]>(`/cases/${caseId}/milestones`)
      return res.data
    }
    await delay(120)
    return mockServer.getMilestones(caseId)
  },

  async submitMilestone(milestoneId: string, materials: any[]): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<ProjectMilestone>(`/milestones/${milestoneId}/submit`, { materials })
      return res.data
    }
    await delay(200)
    return mockServer.submitMilestone(milestoneId, materials)
  },

  async updateMilestoneStatus(milestoneId: string, status: any, feedback?: string): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.patch<ProjectMilestone>(`/milestones/${milestoneId}/status`, { status, feedback })
      return res.data
    }
    await delay(150)
    return mockServer.updateMilestoneStatus(milestoneId, status, feedback)
  },

  async createMilestone(caseId: string, data: { title: string; description: string; deadline: string }): Promise<ProjectMilestone> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<ProjectMilestone>(`/cases/${caseId}/milestones`, data)
      return res.data
    }
    return mockServer.createMilestone(caseId, data)
  },

  async deleteMilestone(milestoneId: string): Promise<void> {
    if (apiRuntime.mode === 'live') {
      await axiosInstance.delete(`/milestones/${milestoneId}`)
      return
    }
    mockServer.deleteMilestone(milestoneId)
  },

  async getSubmission(caseId: string): Promise<ProjectSubmission | undefined> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<ProjectSubmission>(`/cases/${caseId}/submission`)
      return res.data
    }
    await delay(100)
    return mockServer.getSubmission(caseId)
  },

  async createSubmission(data: any): Promise<ProjectSubmission> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<ProjectSubmission>('/submissions', data)
      return res.data
    }
    await delay(250)
    return mockServer.createSubmission(data)
  },

  async getEvaluation(caseId: string): Promise<ProjectEvaluation | undefined> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<ProjectEvaluation>(`/cases/${caseId}/evaluation`)
      return res.data
    }
    await delay(100)
    return mockServer.getEvaluation(caseId)
  },

  async createEvaluation(data: any): Promise<ProjectEvaluation> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<ProjectEvaluation>('/evaluations', data)
      return res.data
    }
    await delay(250)
    return mockServer.createEvaluation(data)
  },

  // Student Projects Showcase
  async getStudentProjects(filters?: any): Promise<StudentProject[]> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<StudentProject[]>('/student-projects', { params: filters })
      return res.data
    }
    await delay(150)
    return mockServer.getStudentProjects(filters)
  },

  async getStudentProjectById(id: string): Promise<StudentProject> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<StudentProject>(`/student-projects/${id}`)
      return res.data
    }
    await delay(120)
    const p = mockServer.getStudentProjectById(id)
    if (!p) throw new Error('Проект не найден')
    return p
  },

  async createStudentProject(data: any): Promise<StudentProject> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.post<StudentProject>('/student-projects', data)
      return res.data
    }
    await delay(220)
    return mockServer.createStudentProject(data)
  },

  async toggleStudentProjectLike(id: string): Promise<StudentProject> {
    await delay(100)
    return mockServer.toggleStudentProjectLike(id)
  },

  // Companies
  async getCompanies(): Promise<Company[]> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<Company[]>('/companies')
      return res.data
    }
    await delay(120)
    return mockServer.getCompanies()
  },

  async getCompanyById(id: string): Promise<Company> {
    if (apiRuntime.mode === 'live') {
      const res = await axiosInstance.get<Company>(`/companies/${id}`)
      return res.data
    }
    await delay(120)
    const c = mockServer.getCompanyById(id)
    if (!c) throw new Error('Компания не найдена')
    return c
  },

  async verifyCompany(id: string, status: boolean): Promise<Company> {
    await delay(150)
    return mockServer.verifyCompany(id, status)
  },

  // Students & Teams
  async getStudents(filters?: any): Promise<User[]> {
    await delay(150)
    return mockServer.getStudents(filters)
  },

  async inviteStudent(studentId: string, caseId: string, type: string, message: string): Promise<void> {
    await delay(180)
    mockServer.inviteStudent(studentId, caseId, type, message)
  },

  async getTeams(): Promise<ProjectTeam[]> {
    await delay(120)
    return mockServer.getTeams()
  },

  async createTeam(data: any): Promise<ProjectTeam> {
    await delay(200)
    return mockServer.createTeam(data)
  },

  // Comments
  async getComments(caseId: string): Promise<ProjectComment[]> {
    await delay(100)
    return mockServer.getComments(caseId)
  },

  async addComment(data: any): Promise<ProjectComment> {
    await delay(150)
    return mockServer.addComment(data)
  },

  // Notifications
  async getNotifications(userId: string): Promise<SystemNotification[]> {
    await delay(100)
    return mockServer.getNotifications(userId)
  },

  async markNotificationRead(id: string): Promise<void> {
    await delay(50)
    mockServer.markNotificationRead(id)
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    await delay(80)
    mockServer.markAllNotificationsRead(userId)
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    await delay(120)
    return mockServer.getAuditLogs()
  },
}
