import { collectNumbered, fromUser } from './backend'
import type { User } from '../types/models'

export function createUserManagement(http: any) {
  return {
    async requestRole(data: {
      username: string
      email: string
      password: string
      role: 'company' | 'curator'
    }): Promise<string> {
      const { data: result } = await http.post('/auth/register', {
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role === 'company' ? 'company_representative' : 'university_staff',
        consent_version: '1',
      })
      return result.user_id
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
