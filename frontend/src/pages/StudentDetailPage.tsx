import { publicationLabels, publicationStatus, isPublished } from '../utils/publication'
import React, { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchStudentProjectByIdRequest, likeStudentProjectRequest } from '../store/actions'
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
  const { studentsList: authors } = useAppSelector((state) => state.students)
  const { activeProject, loading } = useAppSelector((state) => state.studentProjects)

  useEffect(() => {
    if (id) {
      dispatch(fetchStudentProjectByIdRequest(id))
    }
  }, [dispatch, id])

  if (loading || !activeProject || activeProject.id !== id) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>Загрузка проекта...</div>
  }

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
      <div style={{ marginBottom: '20px' }}>
        <Link to="/student-projects" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Назад к студенческим проектам
        </Link>
      </div>

      <div className="responsive-detail-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div>
          <div className="card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
            <img
              src={activeProject.coverImage}
              alt=""
              style={{ width: '100%', height: '320px', objectFit: 'cover' }}
            />

            <div className="card__body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="badge badge-direction" style={{ textTransform: 'uppercase' }}>
                  {activeProject.category} • {activeProject.direction}
                </span>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => dispatch(likeStudentProjectRequest(activeProject.id))}
                  style={{ color: '#e11d48' }}
                >
                  <Heart size={15} fill="#e11d48" /> {activeProject.likesCount}
                </button>
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f2b48', margin: '0 0 16px' }}>
                {activeProject.title}
              </h1>

              {!isPublished(activeProject) && <p className={`badge publication-${publicationStatus(activeProject)}`}>{publicationLabels[publicationStatus(activeProject)]}</p>}
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
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: '12px 16px', borderRadius: '8px' }}>
                  {activeProject.problemSolved}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', color: '#0f2b48', marginBottom: '8px' }}>
                  Подробное описание:
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {activeProject.fullDescription}
                </p>
              </div>

              {/* Links */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                {activeProject.githubUrl && (
                  <a href={activeProject.githubUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                    <Github size={15} /> GitHub репозиторий
                  </a>
                )}
                {activeProject.productUrl && (
                  <a href={activeProject.productUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
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
                    {authors.find((author) => author.id === activeProject.authorId)?.fullName || activeProject.authorName}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {activeProject.teamName ? `Команда: ${activeProject.teamName}` : 'Студент'}
                  </span>
                </div>
              </div>

              <Link to={`/profile/${activeProject.authorId}`} className="btn btn-secondary btn-sm btn-wide">
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
    </div>
  )
}
