import type { CaseProject, ProjectTeam, User } from '../types/models'

export const isAdmin = (user: User | null | undefined) => user?.role === 'admin'
export const canManageCase = (user: User | null | undefined, project: CaseProject) =>
  isAdmin(user) || (user?.role === 'company' && !!user.companyProfile?.companyId
    && user.companyProfile.companyId === project.companyId)

export const participatesInCase = (userId: string, project: CaseProject, teams: ProjectTeam[]) =>
  project.assignedStudentId === userId || teams.some((team) =>
    (team.id === project.assignedTeamId || team.caseId === project.id)
    && (team.leaderId === userId || team.members.some((member) => member.id === userId)))

export const visibleCasesFor = (user: User | null | undefined, projects: CaseProject[]) =>
  user?.role === 'company' ? projects.filter((p) => p.companyId === user.companyProfile?.companyId) : projects
