import { complexityBadge } from '../utils/publication'
import { apiRuntime } from '../api/runtime'
import { formatDate } from '../utils/date'
import { PaginatedGrid } from '../components/PaginatedGrid'
import { ScrollToolbar } from '../components/ScrollToolbar'
import {
  publicationLabels,
  publicationStatus,
  isPublished,
  matchesSearch,
} from '../utils/publication'
import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  fetchCasesRequest,
  fetchFavoritesRequest,
  resetCaseFilters,
  setCaseFilters,
  toggleFavoriteRequest,
} from '../store/actions'
import { visibleCasesFor } from '../utils/access'
import { selectShowcaseCases, ShowcaseSort } from '../utils/showcase'
import { CreateCaseModal } from '../components/modals/CreateCaseModal'
import {
  GraduationCap,
  Award,
  Bookmark,
  Briefcase,
  FolderGit2,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  RussianRuble,
  FileLock2,
  Filter,
  Flame,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

export const CasesShowcasePage: React.FC = () => {
  const dispatch = useAppDispatch()
  const location = useLocation()
  useEffect(() => {
    sessionStorage.setItem('cases-return-url', location.pathname + location.search)
  }, [location.pathname, location.search])
  const { casesList, favorites, filters, loading, error } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [eventFormat, setEventFormat] = useState('all')
  const live = apiRuntime.mode === 'live'
  const requestFilters = live ? undefined : filters
  const [recruiting, setRecruiting] = useState(false)

  useEffect(() => {
    dispatch(fetchCasesRequest(requestFilters))
  }, [dispatch, requestFilters])

  useEffect(() => {
    dispatch(fetchFavoritesRequest())
  }, [dispatch])

  const [sort, setSort] = useState<ShowcaseSort>('newest')
  const cases = visibleCasesFor(currentUser, casesList)
  const directions = [...new Set(cases.map((item) => item.direction).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'ru'),
  )
  const filteredCases = cases.filter(
    (item) =>
      (eventFormat === 'all' || (item.kind || 'case') === eventFormat) &&
      (!live ||
        (matchesSearch(
          filters.search,
          item.title,
          item.companyName,
          item.shortDescription,
          item.requiredCompetencies,
          item.recommendedTech,
        ) &&
          (filters.direction === 'all' || item.direction === filters.direction) &&
          (filters.complexity === 'all' || item.complexity === filters.complexity) &&
          (filters.workFormat === 'all' || item.workFormat === filters.workFormat) &&
          (filters.rewardType === 'all' || item.rewardType === filters.rewardType) &&
          (!filters.hasReward ||
            !!item.prizeFund ||
            !!item.rewardAmount ||
            !!item.rewardDescription))),
  )
  const visibleCases = selectShowcaseCases(filteredCases, {
    period: 'all',
    technology: 'all',
    recruiting,
    sort,
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCaseFilters({ search: e.target.value }))
  }

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setCaseFilters({ [key]: value }))
  }

  const handleResetFilters = () => {
    setRecruiting(false)
    setSort('newest')
    setEventFormat('all')
    dispatch(resetCaseFilters())
  }

  const handleToggleFav = (e: React.MouseEvent, caseId: string) => {
    e.preventDefault()
    dispatch(toggleFavoriteRequest(caseId))
  }

  const canCreateCase =
    currentUser?.role === 'company' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'university'

  const getRewardBadge = (c: any) => {
    if (c.rewardType === 'contest') {
      return (
        <span className="badge badge-reward-contest">
          <Award size={13} /> Конкурсный • Фонд {c.prizeFund?.toLocaleString('ru-RU')} ₽
        </span>
      )
    }
    if (c.rewardType === 'monetary') {
      return (
        <span className="badge badge-reward-monetary">
          <RussianRuble size={13} /> {c.rewardAmount?.toLocaleString('ru-RU')} ₽ за результат
        </span>
      )
    }
    if (c.rewardType === 'educational') {
      return (
        <span className="badge badge-reward-educational">
          <GraduationCap size={14} aria-hidden="true" /> Зачет практики + Сертификат
        </span>
      )
    }
    return (
      <span className="badge badge-reward-other">
        <Briefcase size={14} aria-hidden="true" /> Стажировка / Оффер
      </span>
    )
  }

  return (
    <div>
      {/* Top Banner & Title in Clean University Style */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#0c1938',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {currentUser?.role === 'company'
              ? 'Мои ИТ-кейсы'
              : 'Витрина ИТ-проектов и кейсов предприятий'}
          </h1>
          <p style={{ fontSize: '12.5px', color: '#5e7188', margin: '4px 0 0' }}>
            Автоматизированная система проектного обучения
          </p>
        </div>
        {canCreateCase && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreateModalOpen(true)}>
            <Plus size={15} /> Разместить публикацию
          </button>
        )}
      </div>

      {/* UUST Schedule-Style Filter Container (Authorial Upgrade of ISU widget) */}
      <ScrollToolbar>
        <div className="uust-container">
          <div className="uust-box">
            {/* Row 1: Search input */}
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
                  aria-label="Поиск кейсов"
                  value={filters.search}
                  onChange={handleSearchChange}
                  placeholder="Название, компания или стек"
                />
              </div>
              <label className="catalog-sort">
                Сортировать
                <select
                  className="uust-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ShowcaseSort)}
                >
                  <option value="newest">Сначала новые</option>
                  <option value="deadline">Ближайший дедлайн</option>
                  {!live && <option value="popular">По заявкам</option>}
                </select>
              </label>
            </div>

            {/* Row 2: Clean dropdowns like on photo */}
            <div className="uust-filter-row">
              <select
                className="uust-select"
                style={{ flex: 1, minWidth: 'min(200px, 100%)' }}
                aria-label="Направление разработки"
                value={filters.direction}
                onChange={(e) => handleFilterChange('direction', e.target.value)}
              >
                <option value="all">Все направления разработки</option>
                {(live
                  ? directions
                  : [
                      'Искусственный интеллект',
                      'Компьютерное зрение',
                      'Мобильная разработка',
                      'Frontend',
                      'Backend',
                      'Информационная безопасность',
                      'IoT',
                      'Программирование',
                      'Математика',
                    ]
                ).map((direction) => (
                  <option key={direction}>{direction}</option>
                ))}
              </select>

              <select
                className="uust-select"
                style={{ width: '210px', flexShrink: 0 }}
                aria-label="Уровень сложности"
                value={filters.complexity}
                onChange={(e) => handleFilterChange('complexity', e.target.value)}
              >
                <option value="all">Уровень: любой</option>
                <option value="Начальный">Начальный</option>
                <option value="Средний">Средний</option>
                <option value="Высокий">Высокий</option>
              </select>

              <select
                className="uust-select"
                style={{ flex: 1, minWidth: 'min(180px, 100%)' }}
                value={filters.rewardType}
                onChange={(e) => handleFilterChange('rewardType', e.target.value)}
              >
                <option value="all">Форма: Все формы</option>
                <option value="contest">Конкурсный грант / Призовой</option>
                <option value="monetary">Оплата за результат</option>
                <option value="educational">Зачет практики / ВКР</option>
                <option value="other">Стажировка и оффер</option>
              </select>

              <select
                className="uust-select"
                style={{ flex: 1, minWidth: 'min(150px, 100%)' }}
                value={filters.workFormat}
                onChange={(e) => handleFilterChange('workFormat', e.target.value)}
              >
                <option value="all">Формат: Все</option>
                <option value="дистанционный">Дистанционный</option>
                <option value="смешанный">Смешанный</option>
                <option value="очный">Очный (в лаборатории)</option>
              </select>
            </div>

            {/* Row 3: Semester pills matching the screenshot */}
            <div className="uust-pills-row">
              <select
                aria-label="Тип события"
                className="uust-select"
                value={eventFormat}
                onChange={(e) => setEventFormat(e.target.value)}
              >
                <option value="all">Все события</option>
                <option value="case">Кейсы</option>
                <option value="hackathon">Хакатоны</option>
                <option value="olympiad">Олимпиады</option>
              </select>
              <button
                type="button"
                className={`uust-pill ${recruiting ? 'active' : ''}`}
                aria-pressed={recruiting}
                onClick={() => setRecruiting(!recruiting)}
              >
                Только с открытым набором
              </button>
              <button
                className={`uust-pill ${filters.hasReward ? 'active' : ''}`}
                onClick={() => handleFilterChange('hasReward', !filters.hasReward)}
                style={{ marginLeft: 'auto' }}
              >
                <RussianRuble size={14} aria-hidden="true" /> Только с оплатой / призом
              </button>

              <button
                onClick={handleResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e04646',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 700,
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
      </ScrollToolbar>

      {/* Section Subheader matching photo "Группа ТОП-204Б(73) Неделя 7" */}

      {/* Case Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          Загрузка витрины кейсов...
        </div>
      ) : error ? (
        <div className="card" role="alert" style={{ padding: 24 }}>
          <h3>Не удалось загрузить кейсы</h3>
          <p>{error}</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => dispatch(fetchCasesRequest(requestFilters))}
          >
            Повторить загрузку
          </button>
        </div>
      ) : visibleCases.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <FolderGit2 size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Кейсы не найдены</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
            По заданным фильтрам проектов не найдено. Попробуйте сбросить фильтры.
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleResetFilters}
            style={{ margin: '0 auto' }}
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <PaginatedGrid>
          {visibleCases.map((item) => {
            const isFav = favorites.includes(item.id)

            return (
              <div key={item.id} className="case-card">
                <div
                  className={`case-card__top-accent ${
                    item.rewardType === 'contest'
                      ? 'case-card__top-accent--contest'
                      : item.direction.includes('Интеллект') || item.direction.includes('зрение')
                        ? 'case-card__top-accent--ai'
                        : ''
                  }`}
                />

                {currentUser?.role === 'student' && (
                  <button
                    className={`case-card__fav-btn ${isFav ? 'favorited' : ''}`}
                    onClick={(e) => handleToggleFav(e, item.id)}
                    aria-pressed={isFav}
                    title={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
                  >
                    <Bookmark size={15} fill={isFav ? '#e04646' : 'none'} />
                  </button>
                )}

                <div className="card__body">
                  <div className="case-card__company">
                    <img
                      src={item.companyLogo || 'https://via.placeholder.com/36'}
                      alt={item.companyName}
                    />
                    <div>
                      <div className="company-title">{item.companyName}</div>
                      <div className="company-sub">Индустриальный партнёр</div>
                    </div>
                    <span className="badge badge-verified" style={{ marginLeft: 'auto' }}>
                      <ShieldCheck size={11} /> Верифицирован
                    </span>
                  </div>

                  <h3 className="case-card__title">
                    <Link to={`/cases/${item.id}`}>{item.title}</Link>
                  </h3>

                  <p className="case-card__desc">{item.shortDescription}</p>
                  {!isPublished(item) && (
                    <p className={`badge publication-${publicationStatus(item)}`}>
                      {publicationLabels[publicationStatus(item)]}
                    </p>
                  )}
                  {item.moderationComment && (
                    <p className="moderation-comment">{item.moderationComment}</p>
                  )}

                  <div className="case-card__tags">
                    <span className="badge badge-direction">
                      {
                        {
                          case: 'Проект',
                          hackathon: 'Хакатон',
                          olympiad: 'Олимпиада',
                          internship: 'Стажировка',
                        }[item.kind || 'case']
                      }
                    </span>
                    {item.direction && (
                      <span className="badge badge-direction">{item.direction}</span>
                    )}
                    <span className={`badge ${complexityBadge(item.complexity)}`}>
                      Уровень: {item.complexity.toLowerCase()}
                    </span>
                    {item.isConfidential && (
                      <span className="badge badge-confidential">
                        <FileLock2 size={12} /> Конфиденциальность (NDA)
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: '14px' }}>{getRewardBadge(item)}</div>

                  <div className="case-card__meta-grid">
                    <div className="meta-item">
                      <Calendar size={13} />
                      <span>
                        Дедлайн: <strong>{formatDate(item.deadlineDate)}</strong>
                      </span>
                    </div>
                    <div className="meta-item">
                      <Users size={13} />
                      <span>
                        Команда:{' '}
                        <strong>
                          {item.participationFormat === 'individual'
                            ? '1 чел.'
                            : `${item.teamSize.min}–${item.teamSize.max} чел.`}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {item.recommendedTech.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.recommendedTech.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          style={{
                            fontSize: '11px',
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                      {item.recommendedTech.length > 4 && (
                        <span style={{ fontSize: '10px', color: '#94a3b8', alignSelf: 'center' }}>
                          +{item.recommendedTech.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="case-card__footer-bar">
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Заявок: <strong>{item.applicationsCount}</strong>
                  </span>
                  <Link to={`/cases/${item.id}`} className="btn btn-primary btn-sm">
                    Подробнее о кейсе →
                  </Link>
                </div>
              </div>
            )
          })}
        </PaginatedGrid>
      )}

      {/* Modal for creating a new case */}
      <CreateCaseModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  )
}
