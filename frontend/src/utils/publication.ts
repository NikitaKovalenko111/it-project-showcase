import type { CaseProject, StudentProject, User } from '../types/models'

export const canModerate = (user?: User | null) => !!user && ['curator', 'university', 'admin'].includes(user.role)
export const publicationStatus = (project: Pick<StudentProject, 'isModerated' | 'moderationStatus'>) =>
  project.moderationStatus || (project.isModerated ? 'approved' : 'pending')
export const isPublished = (project: Pick<StudentProject, 'isModerated' | 'moderationStatus'>) => publicationStatus(project) === 'approved'
export const publicationLabels = { pending: 'На рассмотрении', approved: 'Опубликован', rejected: 'Отклонен', revision: 'На доработке', hidden: 'Скрыт' }
export const caseStatusLabels: Record<CaseProject['status'], string> = {
  open: 'Открыт набор', application: 'Прием заявок', selection: 'Отбор', accepted: 'Команда сформирована',
  in_progress: 'В работе', submitted: 'Результат сдан', review: 'На проверке', revision: 'На доработке',
  completed: 'Завершен', archived: 'В архиве', moderation: 'На рассмотрении',
}
export const matchesSearch = (query: string, ...values: unknown[]) =>
  values.flat().filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))

export const visibleStudentProjectsFor = (user: User | null | undefined, projects: StudentProject[]) =>
  projects.filter((project) => isPublished(project) || canModerate(user) || project.authorId === user?.id)
