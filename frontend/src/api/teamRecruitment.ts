import type { AxiosInstance } from 'axios'
import type { ProjectTeam } from '../types/models'

// The invitation endpoint currently accepts UUIDs with versions 1–5 and the RFC variant.
const invitationId = /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i

export function teamInvitationIssue(teamId: string, studentId: string) {
  if (!invitationId.test(teamId)) return 'Сервер не принимает ID этой команды для приглашений.'
  if (!invitationId.test(studentId)) return 'Сервер не принимает ID этого студента для приглашений.'
}

export function createTeamRecruitmentApi(http: Pick<AxiosInstance, 'post' | 'put'>) {
  return {
    async invite(teamId: string, studentId: string) {
      const issue = teamInvitationIssue(teamId, studentId)
      if (issue) throw new Error(issue)
      await http.post(`/teams/${teamId}/invitations`, { student_id: studentId })
    },
    async setOpen(team: Pick<ProjectTeam, 'id' | 'name' | 'description'>, open: boolean) {
      await http.put(`/teams/${team.id}/discovery`, {
        name: team.name,
        description: team.description ?? '',
        visibility: open ? 'open' : 'private',
        looking_for_members: open,
      })
    },
  }
}
