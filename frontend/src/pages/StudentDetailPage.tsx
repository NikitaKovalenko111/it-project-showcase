import { apiClient } from '../api/client'
import { useConfirm } from '../components/ConfirmProvider'
import { RichMarkdown } from '../components/RichMarkdown'
import { apiRuntime } from '../api/runtime'
import { FileDownload } from '../components/FileDownload'
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

function ProjectScreenshot({ url, label }: { url: string; label: string }) {
  const [unavailable, setUnavailable] = useState(false)
  if (unavailable) return <span className="screenshot-unavailable">Скриншот недоступен</span>
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        loading="lazy"
        alt={label}
        onError={() => setUnavailable(true)}
        style={{ width: 160, maxWidth: '100%' }}
      />
    </a>
  )
}

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
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
        Загрузка проекта...
      </div>
    )
  }

  const owner = activeProject.authorId === currentUser?.id
  const server = activeProject.server
  const reviewer =
    ['curator', 'university'].includes(currentUser?.role || '') && server?.status === 'moderation'
  const canEdit = owner && (server?.status === 'draft' || server?.status === 'revision')
  const protectedFiles =
    (owner || currentUser?.role === 'admin' || reviewer) &&
    !activeProject.coverImage &&
    !activeProject.screenshots.length &&
    server
      ? [
          ...(server.coverFileId ? [{ id: server.coverFileId, name: 'Обложка' }] : []),
          ...server.assets
            .filter((asset) => asset.kind === 'screenshot')
            .map((asset, index) => ({
              id: asset.file_id,
              name: `Скриншот ${index + 1}`,
            })),
        ]
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
      <div className="detail-actions">
        <Link to="/student-projects" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Назад к студенческим проектам
        </Link>
        {canEdit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
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
            {activeProject.coverImage && (
              <img
                src={activeProject.coverImage}
                alt=""
                style={{ width: '100%', height: '320px', objectFit: 'cover' }}
              />
            )}

            <div className="card__body">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
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
                  style={{ color: '#e11d48' }}
                >
                  <Heart size={15} fill={activeProject.likedByMe ? '#e11d48' : 'none'} />{' '}
                  {activeProject.likesCount}
                </button>
              </div>

              <h1
                style={{ fontSize: '24px', fontWeight: 800, color: '#0f2b48', margin: '0 0 16px' }}
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
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #bae6fd',
                    }}
                  >
                    <Tag size={12} aria-hidden="true" /> {getBadgeTitle(b)}
                  </span>
                ))}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', color: '#0f2b48', marginBottom: '6px' }}>
                  <Lightbulb size={14} aria-hidden="true" /> Решаемая проблема:
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#334155',
                    lineHeight: 1.6,
                    background: '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: '8px',
                  }}
                >
                  {activeProject.problemSolved}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', color: '#0f2b48', marginBottom: '8px' }}>
                  Подробное описание:
                </h3>
                <div
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#334155',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                  }}
                >
                  <RichMarkdown text={activeProject.fullDescription} />
                </div>
              </div>

              {(activeProject.screenshots.length > 0 || protectedFiles.length > 0) && (
                <section>
                  <h3>Изображения проекта</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {activeProject.screenshots.map((url, index) => (
                      <ProjectScreenshot key={url} url={url} label={`Скриншот ${index + 1}`} />
                    ))}
                    {protectedFiles.map((file) => (
                      <FileDownload
                        key={file.id}
                        file={{
                          name: file.name,
                          url: reviewer
                            ? `${apiRuntime.baseUrl || '/api/v1'}/student-projects/${activeProject.id}/review/files/${file.id}`
                            : `${apiRuntime.baseUrl || '/api/v1'}/files/${file.id}`,
                        }}
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
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <User size={22} color="#1b5e91" />
                </div>
                <div>
                  <strong style={{ fontSize: '14px', color: '#1e293b', display: 'block' }}>
                    {authors.find((author) => author.id === activeProject.authorId)?.fullName ||
                      activeProject.authorName}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
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
                      background: '#f1f5f9',
                      color: '#1e293b',
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
