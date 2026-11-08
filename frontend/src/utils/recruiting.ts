import type { CaseProject } from '../types/models'
export const canReceiveApplications = (project: CaseProject) => {
  const capacity = project.maxTeams ?? null
  const accepted =
    project.acceptedTeamsCount ?? (project.assignedTeamId || project.assignedStudentId ? 1 : 0)
  return (
    ['open', 'application', 'selection', 'in_progress'].includes(project.status) &&
    (capacity === null || accepted < capacity)
  )
}
