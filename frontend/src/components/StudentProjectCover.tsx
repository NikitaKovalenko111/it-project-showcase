import type { CSSProperties } from 'react'
import { useAppSelector } from '../store'
import { apiRuntime } from '../api/runtime'
import type { StudentProject } from '../types/models'
import { studentProjectCover } from '../utils/projectMedia'
import { ApiImage } from './ApiImage'
export function StudentProjectCover({
  project,
  style,
}: {
  project: StudentProject
  style?: CSSProperties
}) {
  const user = useAppSelector((state) => state.auth.currentUser)
  const src = studentProjectCover(project, user, apiRuntime.baseUrl || '/api/v1')
  return src ? (
    <ApiImage src={src} alt={`Обложка: ${project.title}`} style={style} />
  ) : (
    <span className="project-cover-placeholder" aria-label="Обложка не добавлена" />
  )
}
