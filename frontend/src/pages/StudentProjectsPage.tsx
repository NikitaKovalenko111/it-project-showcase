import { PublicationReviewQueue } from '../components/PublicationReviewQueue'
import { canModerate, isPublished, publicationLabels, publicationStatus } from '../utils/publication'
import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  fetchStudentProjectsRequest,
  likeStudentProjectRequest,
  setStudentProjectFilters,
} from '../store/actions'
import { CreateStudentProjectModal } from '../components/modals/CreateStudentProjectModal'
import {
  Code2,
  GraduationCap,
  ExternalLink,
  FolderGit2,
  Github,
  Heart,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trophy,
  User,
} from 'lucide-react'

export const StudentProjectsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { studentsList: authors } = useAppSelector((state) => state.students)
  const { projectsList, filters, loading } = useAppSelector((state) => state.studentProjects)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [query] = useSearchParams()
  const [section, setSection] = useState<'catalog' | 'review' | 'mine'>(query.get('review') === 'student' && canModerate(currentUser) ? 'review' : 'catalog')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedQuickCategory, setSelectedQuickCategory] = useState<string>('all')

  useEffect(() => {
    dispatch(fetchStudentProjectsRequest(section === 'review' ? undefined : filters))
  }, [dispatch, filters, section])

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setStudentProjectFilters({ [key]: value }))
  }

  const handleQuickCategory = (cat: string) => {
    setSelectedQuickCategory(cat)
    dispatch(setStudentProjectFilters({ category: cat }))
  }

  const handleLike = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    dispatch(likeStudentProjectRequest(id))
  }

  const getBadgeTitle = (b: string) => {
    switch (b) {
      case 'seeking_company':
        return 'Ищу компанию'
      case 'seeking_team':
        return 'Ищу команду'
      case 'seeking_mentor':
        return 'Ищу ментора'
      case 'seeking_investor':
        return 'Ищу инвестора'
      case 'open_for_internship':
        return 'На стажировку'
      case 'open_for_job':
        return 'Открыт к офферу'
      default:
        return b
    }
  }

  const catalogProjects = projectsList.filter((project) => section === 'mine' ? project.authorId === currentUser?.id : isPublished(project))
  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__content">
          <h1>Витрина студенческих проектов</h1>
          <p>
            Открытый каталог авторских разработок студентов: pet-проекты, курсовые работы, ВКР, стартапы и победители хакатонов.
          </p>
        </div>
        <div className="page-header__actions">
          {currentUser?.role === 'student' && (
            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
              <Plus size={16} /> Опубликовать проект
            </button>
          )}
        </div>
      </div>

      <div className="tabs-bar">
        <button className={`tab-btn ${section === 'catalog' ? 'active' : ''}`} onClick={() => setSection('catalog')}>Опубликованные проекты</button>
        {currentUser?.role === 'student' && <button className={`tab-btn ${section === 'mine' ? 'active' : ''}`} onClick={() => setSection('mine')}>Мои публикации</button>}
        {canModerate(currentUser) && <button className={`tab-btn ${section === 'review' ? 'active' : ''}`} onClick={() => setSection('review')}>Одобрение публикаций</button>}
      </div>
      {section === 'review' ? <PublicationReviewQueue kind="student" /> : <>
      {/* UUST Schedule-Style Filter Container */}
      <div className="uust-container">
        <div className="uust-tabs-row">
          <button
            className={`uust-tab ${filters.category === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('category', 'all')}
          >
            Все разработки
          </button>
          <button
            className={`uust-tab ${filters.category === 'стартап' ? 'active' : ''}`}
            onClick={() => handleFilterChange('category', 'стартап')}
          >
            <Rocket size={14} aria-hidden="true" /> Стартапы и MVP
          </button>
          <button
            className={`uust-tab ${filters.category === 'pet-проект' ? 'active' : ''}`}
            onClick={() => handleFilterChange('category', 'pet-проект')}
          >
            <Code2 size={14} aria-hidden="true" /> Pet-проекты
          </button>
          <button
            className={`uust-tab ${filters.category === 'ВКР' ? 'active' : ''}`}
            onClick={() => handleFilterChange('category', 'ВКР')}
          >
            <GraduationCap size={14} aria-hidden="true" /> Дипломы и ВКР
          </button>
        </div>

        <div className="uust-box">
          <div className="uust-filter-row">
            <div style={{ position: 'relative', flex: 1, minWidth: 'min(240px, 100%)' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                className="uust-input"
                style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Поиск по названию разработки, автору или стеку (React, Python, ESP32, Docker)..."
              />
            </div>
          </div>

          <div className="uust-filter-row">
            <select
              className="uust-select"
              style={{ flex: 1, minWidth: 'min(180px, 100%)' }}
              aria-label="Направление разработки" value={filters.direction}
              onChange={(e) => handleFilterChange('direction', e.target.value)}
            >
              <option value="all">Все направления разработки</option>
              <option value="Frontend">Frontend-разработка</option>
              <option value="Backend">Backend и микросервисы</option>
              <option value="Fullstack">Fullstack-решения</option>
              <option value="Искусственный интеллект">Искусственный интеллект и ML</option>
              <option value="IoT">IoT и робототехника</option>
            </select>

            <select
              className="uust-select"
              style={{ flex: 1, minWidth: 'min(180px, 100%)' }}
              value={filters.badge}
              onChange={(e) => handleFilterChange('badge', e.target.value)}
            >
              <option value="all">Все отметки (бейджы)</option>
              <option value="seeking_company">Ищу компанию / партнёра</option>
              <option value="seeking_team">Ищу команду разработчиков</option>
              <option value="seeking_mentor">Ищу наставника</option>
              <option value="seeking_investor">Ищу инвестора</option>
              <option value="open_for_internship">Открыт к стажировке</option>
              <option value="open_for_job">Открыт к офферу</option>
            </select>

            <button
              onClick={() =>
                dispatch(
                  setStudentProjectFilters({ search: '', category: 'all', direction: 'all', badge: 'all' })
                )
              }
              style={{
                background: 'none',
                border: 'none',
                color: '#e04646',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} />
              Сброс
            </button>
          </div>
        </div>
      </div>

      <div className="uust-section-title">
        <span>Проекты студентов • Найдено: <strong>{catalogProjects.length}</strong></span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#627282' }}>
          Институт информатики, математики и робототехники (ИИМР)
        </span>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>Загрузка проектов...</div>
      ) : catalogProjects.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <FolderGit2 size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Проекты не найдены</h3>
          <p style={{ color: '#64748b', fontSize: '13px' }}>Попробуйте изменить параметры поиска или категорию.</p>
        </div>
      ) : (
        <div className="case-grid">
          {catalogProjects.map((item) => (
            <div key={item.id} className="student-project-card">
              <div className="student-project-card__image-wrap">
                <img src={item.coverImage} alt={item.title} />
                <span className="category-tag">{item.category}</span>
                <button
                  onClick={(e) => handleLike(e, item.id)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#e11d48',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  <Heart size={13} fill="#e11d48" /> {item.likesCount}
                </button>
              </div>

              <div className="student-project-card__body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  <User size={13} />
                  <span>
                    Автор: <strong>{authors.find((author) => author.id === item.authorId)?.fullName || item.authorName}</strong> {item.teamName && `(${item.teamName})`}
                  </span>
                </div>

                <h3 className="student-project-card__title">
                  <Link to={`/student-projects/${item.id}`}>
                    {item.title}
                  </Link>
                </h3>

                <p className="student-project-card__desc">{item.shortDescription}</p>

                {!isPublished(item) && <p className={`badge publication-${publicationStatus(item)}`}>{publicationLabels[publicationStatus(item)]}</p>}
                {item.moderationComment && <p className="moderation-comment">{item.moderationComment}</p>}
                {/* Badges п. 5.15 ТЗ */}
                <div className="student-project-card__badges">
                  {item.badges.map((b) => (
                    <span
                      key={b}
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      <Tag size={12} aria-hidden="true" /> {getBadgeTitle(b)}
                    </span>
                  ))}
                </div>

                {/* Technologies */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', marginBottom: '14px' }}>
                  {item.technologies.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '11px',
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="student-project-card__author-row">
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    {item.githubUrl && (
                      <a href={item.githubUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#1b5e91', fontWeight: 700, textDecoration: 'none' }}>
                        <Github size={14} /> Git
                      </a>
                    )}
                    {item.productUrl && (
                      <a href={item.productUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16805b', fontWeight: 700, textDecoration: 'none' }}>
                        <ExternalLink size={14} /> Демо
                      </a>
                    )}
                  </div>

                  <Link to={`/student-projects/${item.id}`} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
                    Подробнее →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      </>}
      {/* Create Modal */}
      <CreateStudentProjectModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} onSubmitted={() => { setSection('mine'); dispatch(setStudentProjectFilters({ search: '', category: 'all', direction: 'all', badge: 'all' })) }} />
    </div>
  )
}
