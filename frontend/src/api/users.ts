import { collectNumbered, fromRepresentativeDetails, fromUser } from './backend'
import type { RepresentativeDetails, User } from '../types/models'

export function createUserManagement(http: any) {
  return {
    async requestRole(
      data: {
        username: string
        email: string
        password: string
      } & ({ role: 'company'; fullName: string } | { role: 'curator' }),
    ): Promise<string> {
      const { data: result } = await http.post('/auth/register', {
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role === 'company' ? 'company_representative' : 'university_staff',
        ...(data.role === 'company' && { full_name: data.fullName.trim() }),
        consent_version: '1',
      })
      return result.user_id
    },
    async getRepresentativeProfile() {
      return fromRepresentativeDetails((await http.get('/users/me/representative-profile')).data)
    },
    async updateRepresentativeProfile(changes: Partial<RepresentativeDetails>) {
      const { data } = await http.patch('/users/me/representative-profile', {
        ...(changes.bio !== undefined && { experience_and_interests: changes.bio }),
        ...(changes.expertise !== undefined && { help_topics: changes.expertise }),
      })
      return fromRepresentativeDetails(data)
    },
    async reviewRole(userId: string, status: 'approved' | 'rejected'): Promise<void> {
      await http.patch(`/users/${userId}/role-request`, { status })
    },
    async changeRole(userId: string, role: User['role']): Promise<User> {
      const roles: Record<string, string> = {
        student: 'student',
        company: 'company_representative',
        curator: 'university_staff',
      }
      const serverRole = roles[role]
      if (!serverRole) throw new Error('Выберите роль студента, компании или куратора.')
      await http.patch(`/users/${userId}/role`, { role: serverRole })
      const users = await collectNumbered<any>((params) => http.get('/users', { params }))
      const user = users.find((item) => item.user_id === userId)
      if (!user) throw new Error('Роль изменена. Обновите список пользователей.')
      return fromUser(user)
    },
  }
}
