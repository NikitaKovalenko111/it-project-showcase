import { ProjectEvaluation, ProjectSubmission, TeamMember, ProjectMilestone } from './models'
export interface Execution {
  id: string
  caseId: string
  applicationId?: string
  teamId?: string
  studentId?: string
  name: string
  members: TeamMember[]
  status: 'active' | 'submitted' | 'evaluated'
  canSubmitResult?: boolean
  submission?: ProjectSubmission
  evaluation?: ProjectEvaluation
  milestones?: ProjectMilestone[]
}
