import type { StudentProject, User } from '../types/models'
export function studentProjectCover(
  project: StudentProject,
  viewer?: Pick<User, 'id' | 'role'> | null,
  base = '/api/v1',
) {
  if (project.coverImage) return project.coverImage
  const fileId = project.server?.coverFileId
  if (!fileId || !viewer) return ''
  base = base.replace(/\/$/, '')
  if (viewer.id === project.authorId || viewer.role === 'admin') return `${base}/files/${fileId}`
  if (['curator', 'university'].includes(viewer.role) && project.server?.status === 'moderation')
    return `${base}/student-projects/${project.id}/review/files/${fileId}`
  return ''
}
