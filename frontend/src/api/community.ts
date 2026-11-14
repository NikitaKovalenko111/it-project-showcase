import { createWorkflow } from './workflow'
import { collectPages, collectNumbered, fromTeam, fromCompany, fromProject } from './backend'
import { axiosInstance } from './http'
import { apiClient } from './client'
import { apiRuntime } from './runtime'
import type { SystemNotification } from '../types/models'
import { mockServer, MockServer } from './mockServer'

type CommunityMethod =
  | 'getSharedPlan'
  | 'updateSharedPlan'
  | 'getStudentAchievements'
  | 'updateExecutionStage'
  | 'finalizeResults'
  | 'withdrawResults'
  | 'getExecutions'
  | 'submitExecution'
  | 'gradeExecution'
  | 'getLeaderboard'
  | 'reportContent'
  | 'getReports'
  | 'resolveReport'
  | 'setStudentProjectVisibility'
  | 'updateCompanyContent'
  | 'assignStudentCurator'
  | 'likeComment'
  | 'getTeamRequests'
  | 'requestTeam'
  | 'decideTeamRequest'
  | 'getSeekers'
  | 'saveSeeker'
  | 'linkTeamToCase'
  | 'getInvitation'
  | 'respondInvitation'
type AsyncMethods = {
  [K in Exclude<CommunityMethod, 'updateSharedPlan'>]: (
    ...args: Parameters<MockServer[K]>
  ) => Promise<ReturnType<MockServer[K]>>
} & {
  updateSharedPlan: (
    caseId: string,
    rows: Parameters<MockServer['updateSharedPlan']>[1],
    baseline?: Parameters<MockServer['updateSharedPlan']>[1],
  ) => Promise<ReturnType<MockServer['updateSharedPlan']>>
}

const workflow = createWorkflow(axiosInstance)
const teamApplication = (a: any) => ({
  id: a.join_application_id,
  teamId: a.team_id,
  studentId: a.student_id,
  senderId: a.student_id,
  kind: 'application',
  message: a.cover_letter,
  status: a.status,
  createdAt: a.created_at,
})
const companyInvitation = (item: any): SystemNotification => ({
  id: item.invitation_id,
  userId: item.student_id,
  type: 'company_invite',
  title: 'Приглашение от компании',
  message: item.message || '',
  createdAt: item.sent_at,
  read: true,
  invitation: {
    caseId: item.case_id || undefined,
    companyId: item.company_id,
    senderId: item.company_id,
    senderName: 'Представитель компании',
    reason:
      ({ case: 'Участие в кейсе', internship: 'Стажировка' } as Record<string, string>)[
        item.kind
      ] || 'Приглашение',
    status: item.status === 'sent' ? 'pending' : item.status,
    replies: [],
  },
})
export const listCuratedExecutions = workflow.listCuratedExecutions

// Only canonical backend routes are used in live mode.
// Missing endpoints surface an error; live mode never writes to mock storage.
export const communityApi = new Proxy({} as AsyncMethods, {
  get:
    (_target, key: CommunityMethod) =>
    async (...args: unknown[]) => {
      if (apiRuntime.mode === 'live') {
        const [id, value, reason, details] = args as any[]
        if (
          key === 'getExecutions' &&
          JSON.parse(localStorage.getItem('uust_current_user') || 'null')?.role === 'curator'
        )
          return workflow.getCuratedExecutions(id)
        if (key in workflow) return (workflow as any)[key](...args)
        switch (key) {
          case 'getSeekers':
            return (
              await collectNumbered<any>((params) =>
                axiosInstance.get('/team-search-profiles', { params }),
              )
            ).map((d) => ({
              id: d.student_id,
              studentId: d.student_id,
              message: d.description,
              techStack: [],
            }))
          case 'saveSeeker':
            return (
              await axiosInstance.put('/team-search-profile/me', {
                description: value,
                headline: 'Ищу команду',
                is_visible: true,
              })
            ).data
          case 'assignStudentCurator': {
            const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
            if (actor?.role === 'curator') await axiosInstance.put(`/students/${id}/curator/self`)
            else await axiosInstance.put(`/students/${id}/curator`, { curator_id: value })
            return apiClient.getStudentById(id)
          }
          case 'getStudentAchievements': {
            const { data } = await axiosInstance.get(`/students/${id}/portfolio`)
            const results = await Promise.allSettled(
              (data.executions || []).map((e: any) => workflow.getExecution(e.execution_id)),
            )
            return results
              .filter((r: any) => r.status === 'fulfilled' && r.value.evaluation)
              .map((r: any) => ({
                caseId: r.value.caseId,
                score: r.value.evaluation.totalScore,
                maxScore: r.value.evaluation.maxScore,
              }))
          }
          case 'getReports':
            return (
              await collectNumbered<any>((params) => axiosInstance.get('/reports', { params }))
            ).map((d) => ({
              id: d.report_id,
              authorId: d.reporter_id,
              targetType:
                ({ profile: 'user', student_project: 'project' } as any)[d.resource_type] ||
                d.resource_type,
              targetId: d.resource_id,
              reason: d.reason,
              message: d.details,
              status: ['resolved', 'rejected'].includes(d.status) ? 'resolved' : 'pending',
              createdAt: d.created_at,
            }))
          case 'resolveReport':
            await axiosInstance.patch(`/reports/${id}`, {
              status: 'resolved',
              resolution: 'Рассмотрено администратором',
            })
            return
          case 'linkTeamToCase':
            throw new Error(
              'API поддерживает открытый набор команды, но не привязку набора к кейсу',
            )

          case 'getTeamRequests': {
            const actor = JSON.parse(localStorage.getItem('uust_current_user') || 'null')
            if (actor?.role !== 'student') return []
            const [invitations, mine, outgoing] = await Promise.all([
              collectPages<any>((params) => axiosInstance.get('/team-invitations', { params })),
              collectNumbered<any>((params) => axiosInstance.get('/teams/mine', { params })),
              collectNumbered<any>((params) =>
                axiosInstance.get('/team-join-applications/mine', { params }),
              ),
            ])
            const applications = (
              await Promise.all(
                mine
                  .filter((t: any) => t.leader_id === actor.id)
                  .map(async (t: any) =>
                    (
                      (await axiosInstance.get(`/teams/${t.team_id}/join-applications`)).data
                        .items || []
                    ).map((a: any) => ({
                      id: a.join_application_id,
                      teamId: a.team_id,
                      studentId: a.student_id,
                      senderId: a.student_id,
                      kind: 'application',
                      message: a.cover_letter,
                      status: a.status,
                      createdAt: a.created_at,
                    })),
                  ),
              )
            ).flat()
            return [
              ...applications,
              ...outgoing.map(teamApplication),
              ...invitations.map((i) => ({
                id: `invitation:${i.team_invitation_id}`,
                teamId: i.team_id,
                studentId: i.student_id,
                senderId: i.invited_by,
                kind: 'invitation',
                message: 'Приглашение в команду',
                status: i.status,
                createdAt: i.created_at,
              })),
            ]
          }
          case 'requestTeam':
            if (reason === 'invitation') {
              await axiosInstance.post(`/teams/${id}/invitations`, { student_id: value })
              return
            }
            return (
              await axiosInstance.post(`/teams/${id}/join-applications`, {
                cover_letter: details || '',
              })
            ).data
          case 'decideTeamRequest':
            await axiosInstance.patch(
              id.startsWith('invitation:')
                ? `/team-invitations/${id.slice(11)}`
                : `/team-join-applications/${id}`,
              { status: value },
            )
            return
          case 'updateCompanyContent': {
            if ('practiceProgram' in value) throw new Error('API практик пока отсутствует')
            if ('internshipProgram' in value)
              throw new Error(
                'Программы стажировок на сервере — отдельные объявления; редактирование требует отдельной формы',
              )
            const { data } = await axiosInstance.get(`/companies/${id}`)
            return fromCompany(
              (
                await axiosInstance.put(`/companies/${id}`, {
                  full_name: data.full_name,
                  short_name: data.short_name,
                  industry: data.industry,
                  website: data.website,
                  contacts: data.contacts,
                  description: value.description,
                })
              ).data,
            )
          }

          case 'getInvitation': {
            const records = await collectPages<any>((params) =>
              axiosInstance.get('/company-invitations', { params }),
            )
            const invitation = records.find((item) => item.invitation_id === id)
            if (!invitation) throw new Error('Приглашение не найдено')
            return companyInvitation(invitation)
          }
          case 'respondInvitation': {
            if (value !== 'accepted' && value !== 'rejected')
              throw new Error('Выберите действие для приглашения')
            return companyInvitation(
              (await axiosInstance.patch(`/company-invitations/${id}`, { status: value })).data,
            )
          }
          case 'reportContent': {
            if (id === 'internship')
              throw new Error('Сервер пока не поддерживает жалобы на стажировки и практики.')
            return (
              await axiosInstance.post('/reports', {
                resource_type: ({ project: 'student_project', user: 'profile' } as any)[id] || id,
                resource_id: value,
                reason:
                  (
                    {
                      Спам: 'spam',
                      Оскорбления: 'abuse',
                      'Недостоверная информация': 'fraud',
                      'Нарушение авторских прав': 'copyright',
                    } as any
                  )[reason] || 'other',
                details,
              })
            ).data
          }
          case 'setStudentProjectVisibility':
            return fromProject(
              (
                await axiosInstance.patch(`/student-projects/${id}/visibility`, {
                  visibility: value,
                })
              ).data,
            )
          default:
            throw new Error(`Интеграция операции ${key} с API ещё не завершена`)
        }
      }
      return Reflect.apply(mockServer[key], mockServer, args)
    },
})
