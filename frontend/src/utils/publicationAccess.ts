import type { CaseProject, User } from '../types/models'
import { canManageCase } from './access'
type Actor = User | null | undefined
export const canCreatePublication = (user: Actor) =>
  !!user && ['company', 'admin'].includes(user.role)
export const canEditCaseDraft = (user: Actor, project: CaseProject) =>
  !!user &&
  ['draft', 'revision'].includes(project.status) &&
  (user.role === 'company'
    ? canManageCase(user, project)
    : user.role === 'admin' && project.createdBy === user.id)
export const canEditProgram = (
  user: Actor,
  program: { created_by?: string; company_id: string; status: string },
  managedCompanyIds?: string[],
) =>
  !!user &&
  (user.role === 'company'
    ? (managedCompanyIds
        ? managedCompanyIds.includes(program.company_id)
        : user.companyProfile?.companyId === program.company_id) &&
      ['draft', 'revision', 'published'].includes(program.status)
    : user.role === 'admin' &&
      program.created_by === user.id &&
      ['draft', 'revision'].includes(program.status))
