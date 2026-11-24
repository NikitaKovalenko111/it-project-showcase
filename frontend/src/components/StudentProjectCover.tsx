import { useAppSelector } from '../store'
import { apiRuntime } from '../api/runtime'
import type { StudentProject } from '../types/models'
import { studentProjectCover } from '../utils/projectMedia'
import { ApiImage } from './ApiImage'

export function ProjectCover({
  src,
  alt,
  variant = 'cover',
}: {
  src?: string
  alt: string
  variant?: 'cover' | 'thumbnail' | 'detail'
}) {
  const placeholder = (label: string) => (
    <span className="project-cover-placeholder" role="img" aria-label={label} />
  )

  return (
    <div className={`project-cover project-cover--${variant}`}>
      {src ? (
        <ApiImage src={src} alt={alt} fallback={placeholder('Обложка недоступна')} />
      ) : (
        placeholder('Обложка не добавлена')
      )}
    </div>
  )
}

export function StudentProjectCover({
  project,
  variant = 'cover',
}: {
  project: StudentProject
  variant?: 'cover' | 'thumbnail'
}) {
  const user = useAppSelector((state) => state.auth.currentUser)
  const src = studentProjectCover(project, user, apiRuntime.baseUrl || '/api/v1')
  return <ProjectCover src={src} alt={`Обложка: ${project.title}`} variant={variant} />
}
