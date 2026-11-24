import type { AxiosInstance } from 'axios'
import type { Company, CompanyStatus, User } from '../types/models'
import { collectPages, fromCompany } from './backend'

export type CompanyDraft = {
  full_name: string
  inn: string
  short_name: string
  industry: string
  description: string
  activities: string
  website: string
  contacts: string
  position: string
}

export type CompanyMemberInvitation = {
  invitation_id: string
  company_id: string
  company_name: string
  position?: string
  permissions: string[]
  status: 'pending' | 'accepted' | 'declined' | 'revoked'
}

export const companyStatuses: Record<CompanyStatus, string> = {
  draft: 'Черновик',
  pending: 'На модерации',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  suspended: 'Заблокирована',
}

export function withCompanyMemberships(
  user: User,
  companies: Company[],
  preferredId?: string,
): User {
  const active =
    companies.find((company) => company.id === preferredId) ||
    companies.find((company) => company.isVerified && !company.isBlocked) ||
    companies[0]
  return {
    ...user,
    memberCompanies: companies,
    companyProfile: active && { companyId: active.id, companyName: active.name, position: '' },
  }
}

export function createCompanyMembershipApi(http: AxiosInstance) {
  return {
    async listMine() {
      return (await collectPages((params) => http.get('/companies/mine', { params }))).map(
        fromCompany,
      )
    },
    async save(draft: CompanyDraft, id?: string) {
      const result = id
        ? await http.put(`/companies/${id}`, draft)
        : await http.post('/companies', draft)
      return fromCompany(result.data)
    },
    async submit(id: string) {
      return fromCompany((await http.post(`/companies/${id}/submit-moderation`)).data)
    },
    async invite(companyId: string, userId: string, position: string) {
      await http.post(`/companies/${companyId}/member-invitations`, { user_id: userId, position })
    },
    async listInvitations() {
      return collectPages<CompanyMemberInvitation>(
        (params) => http.get('/company-member-invitations', { params }),
        { status: 'pending' },
      )
    },
    async respond(invitationId: string, status: 'accepted' | 'declined') {
      return fromCompany(
        (await http.patch(`/company-member-invitations/${invitationId}`, { status })).data,
      )
    },
  }
}
