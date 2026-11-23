import { ProjectCover } from '../components/StudentProjectCover'
import { AttachmentPreview } from '../components/AttachmentPreview'
import { apiClient } from '../api/client'
import { useConfirm } from '../components/ConfirmProvider'
import { RichMarkdown } from '../components/RichMarkdown'
import { apiRuntime } from '../api/runtime'
import { LiveStudentProjectEditor } from '../components/modals/LiveStudentProjectEditor'
import { ProjectVisibility } from '../components/ProjectVisibility'
import { ReportButton } from '../components/ReportButton'
import { publicationLabels, publicationStatus, isPublished } from '../utils/publication'
import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  fetchStudentProjectByIdRequest,
  fetchStudentProjectByIdSuccess,
  likeStudentProjectRequest,
} from '../store/actions'
import {
  Lightbulb,
  ArrowLeft,
  Calendar,
  ExternalLink,
  FolderGit2,
  Github,
  Heart,
  Layers,
  Sparkles,
  Tag,
  User,
} from 'lucide-react'

export const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const confirm = useConfirm()
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const { studentsList: authors } = useAppSelector((state) => state.students)
  const { activeProject, loading, error, pendingLikes } = useAppSelector(
    (state) => state.studentProjects,
  )

  useEffect(() => {
    if (id) {
      dispatch(fetchStudentProjectByIdRequest(id))
    }
  }, [dispatch, id])

  if (error)
    return (
      <div className="card feature-panel" role="alert">
        <p>{error}</p>
        <Link to="/student-projects">Вернуться к проектам</Link>
      </div>
    )
  if (loading || !activeProject || activeProject.id !== id) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ui-muted)' }}>
        Загрузка проекта...
      </div>
    )
  }

  const owner = activeProject.authorId === currentUser?.id
  const server = activeProject.server
  const reviewer =
    ['curator', 'university'].includes(currentUser?.role || '') && server?.status === 'moderation'
  const canEdit = owner && (server?.status === 'draft' || server?.status === 'revision')
  const canReadPrivateMedia = owner || currentUser?.role === 'admin' || reviewer
  const mediaUrl = (fileId: string) =>
    reviewer
      ? `${apiRuntime.baseUrl || '/api/v1'}/student-projects/${activeProject.id}/review/files/${fileId}`
      : `${apiRuntime.baseUrl || '/api/v1'}/files/${fileId}`
  const coverUrl =
    activeProject.coverImage ||
    (canReadPrivateMedia && server?.coverFileId ? mediaUrl(server.coverFileId) : '')
  const screenshots = activeProject.screenshots.length
    ? activeProject.screenshots
    : canReadPrivateMedia && server
      ? server.assets
          .filter((asset) => asset.kind === 'screenshot')
          .map((asset) => mediaUrl(asset.file_id))
      : []

  const getBadgeTitle = (b: string) => {
    switch (b) {
      case 'seeking_company':
        return 'Ищу компанию / партнёра'
      case 'seeking_team':
        return 'Ищу команду'
      case 'seeking_mentor':
        return 'Ищу наставника'
      case 'seeking_investor':
        return 'Ищу инвестора'
      case 'open_for_internship':
        return 'Открыт к стажировке'
      case 'open_for_job':
        return 'Открыт к работе'
      default:
        return b
    }
  }

  return (
    <div>
      <div className="detail-actions student-project-actions">
        <Link to="/student-projects" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Назад к студенческим проектам
        </Link>
        {canEdit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm student-project-edit"
            onClick={() => setEditing(true)}
          >
            Редактировать проект
          </button>
        )}
        {currentUser?.role === 'admin' && (
          <button
            className={`btn btn-sm ${publicationStatus(activeProject) === 'hidden' ? 'btn-secondary' : 'btn-danger'}`}
            disabled={busy}
            onClick={async () => {
              const hidden = publicationStatus(activeProject) === 'hidden'
              if (
                !(await confirm(
                  `${hidden ? 'Восстановить' : 'Заблокировать'} проект «${activeProject.title}»?`,
                ))
              )
                return
              setBusy(true)
              setActionError('')
              try {
                await apiClient.moderatePublication(
                  'student',
                  activeProject.id,
                  hidden ? 'approved' : 'hidden',
                  'Решение администратора из карточки проекта',
                )
                dispatch(fetchStudentProjectByIdRequest(activeProject.id))
              } catch (cause) {
                setActionError((cause as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            {publicationStatus(activeProject) === 'hidden'
              ? 'Восстановить проект'
              : 'Заблокировать проект'}
          </button>
        )}
        <ReportButton targetType="project" targetId={activeProject.id} />
      </div>

      {actionError && <p role="alert">{actionError}</p>}
      <div
        className="responsive-detail-grid"
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}
      >
        <div>
          <div className="card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
            {coverUrl && <ProjectCover src={coverUrl} alt="Обложка проекта" variant="detail" />}

            <div className="card__body">
              <div className="student-project-meta">
                <span className="badge badge-direction" style={{ textTransform: 'uppercase' }}>
                  {[activeProject.category, activeProject.direction].filter(Boolean).join(' • ')}
                </span>

                <button
                  className="btn btn-secondary btn-sm project-like"
                  onClick={() => dispatch(likeStudentProjectRequest(activeProject.id))}
                  disabled={
                    !currentUser ||
                    pendingLikes.includes(activeProject.id) ||
                    !isPublished(activeProject)
                  }
                  aria-pressed={!!activeProject.likedByMe}
                  aria-label={activeProject.likedByMe ? 'Убрать лайк' : 'Поставить лайк'}
                  style={{ color: 'var(--ui-danger-accent)' }}
                >
                  <Heart
                    size={15}
                    fill={activeProject.likedByMe ? 'var(--ui-danger-accent)' : 'none'}
                  />{' '}
                  {activeProject.likesCount}
                </button>
              </div>

              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--ui-ink)',
                  margin: '0 0 16px',
                }}
              >
                {activeProject.title}
              </h1>

              {activeProject.visibility !== 'private' && !isPublished(activeProject) && (
                <p className={`badge publication-${publicationStatus(activeProject)}`}>
                  {publicationLabels[publicationStatus(activeProject)]}
                </p>
              )}
              {activeProject.moderationComment && <p>{activeProject.moderationComment}</p>}
              {/* Badges п. 5.15 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {activeProject.badges.map((b) => (
                  <span
                    key={b}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'var(--ui-brand-surface)',
                      color: 'var(--ui-brand-text)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--ui-brand-line)',
                    }}
                  >
                    <Tag size={12} aria-hidden="true" /> {getBadgeTitle(b)}
                  </span>
                ))}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--ui-ink)', marginBottom: '6px' }}>
                  <Lightbulb size={14} aria-hidden="true" /> Решаемая проблема:
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: 'var(--ui-body)',
                    lineHeight: 1.6,
                    background: 'var(--ui-panel)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                  }}
                >
                  {activeProject.problemSolved}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--ui-ink)', marginBottom: '8px' }}>
                  Подробное описание:
                </h3>
                <div
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: 'var(--ui-body)',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                  }}
                >
                  <RichMarkdown text={activeProject.fullDescription} />
                </div>
              </div>

              {screenshots.length > 0 && (
                <section>
                  <h3>Изображения проекта</h3>
                  <div className="student-project-gallery">
                    {screenshots.map((url, index) => (
                      <AttachmentPreview
                        key={url}
                        image
                        file={{ name: `Скриншот ${index + 1}`, url }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Links */}
              <div
                className="student-project-links"
                style={{ display: 'flex', gap: '12px', marginTop: '20px' }}
              >
                {activeProject.githubUrl && (
                  <a
                    href={activeProject.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    <Github size={15} /> GitHub репозиторий
                  </a>
                )}
                {activeProject.productUrl && (
                  <a
                    href={activeProject.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    <ExternalLink size={15} /> Открыть работающий продукт
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Об авторе</h3>
            </div>
            <div className="card__body">
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'var(--ui-line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <User size={22} color="var(--ui-brand-text)" />
                </div>
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--ui-ink)', display: 'block' }}>
                    {authors.find((author) => author.id === activeProject.authorId)?.fullName ||
                      activeProject.authorName}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--ui-muted)' }}>
                    {activeProject.teamName ? `Команда: ${activeProject.teamName}` : 'Студент'}
                  </span>
                </div>
              </div>

              <Link
                to={`/profile/${activeProject.authorId}`}
                className="btn btn-secondary btn-sm btn-wide"
              >
                Перейти в портфолио студента →
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Стек технологий</h3>
            </div>
            <div className="card__body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {activeProject.technologies.map((t) => (
                  <span
                    key={t}
                    style={{
                      background: 'var(--ui-soft)',
                      color: 'var(--ui-ink)',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editing && canEdit && (
        <LiveStudentProjectEditor
          project={activeProject}
          onClose={() => setEditing(false)}
          onSaved={(project) => {
            dispatch(fetchStudentProjectByIdSuccess(project))
            setEditing(false)
          }}
        />
      )}
      {owner && !canEdit && server?.status !== 'hidden' && (
        <details className="card compact-settings">
          <summary>Настройки проекта</summary>
          <ProjectVisibility project={activeProject} />
        </details>
      )}
    </div>
  )
}
