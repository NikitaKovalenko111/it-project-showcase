import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  Award,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileLock2,
  Filter,
  Flame,
  FolderGit2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

export const CasesShowcasePage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { casesList, favorites, filters, loading, error } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'sem1' | 'sem2' | 'year'>('all')
  const [activeTab, setActiveTab] = useState<'cases' | 'recruiting'>('cases')
  const [selectedQuickTech, setSelectedQuickTech] = useState<string>('all')

  useEffect(() => {
    dispatch(fetchCasesRequest(filters))
  }, [dispatch, filters])

  useEffect(() => {
    dispatch(fetchFavoritesRequest())
  }, [dispatch])

  const [sort, setSort] = useState<ShowcaseSort>('newest')
  const visibleCases = selectShowcaseCases(visibleCasesFor(currentUser, casesList), {
    period: selectedPeriod, technology: selectedQuickTech, recruiting: activeTab === 'recruiting', sort,
  })
  const academicYear = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setCaseFilters({ search: e.target.value }))
  }

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setCaseFilters({ [key]: value }))
  }

  const handleQuickTechClick = (tech: string) => {
    setSelectedQuickTech(tech)
  }

  const handleResetFilters = () => {
    setSelectedQuickTech('all')
    setSelectedPeriod('all')
    setActiveTab('cases')
    setSort('newest')
    dispatch(resetCaseFilters())
  }

  const handleToggleFav = (e: React.MouseEvent, caseId: string) => {
    e.preventDefault()
    dispatch(toggleFavoriteRequest(caseId))
  }

  const canCreateCase =
    currentUser?.role === 'company' || currentUser?.role === 'admin' || currentUser?.role === 'university'

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
          <DollarSign size={13} /> {c.rewardAmount?.toLocaleString('ru-RU')} ₽ за результат
        </span>
      )
    }
    if (c.rewardType === 'educational') {
      return <span className="badge badge-reward-educational">🎓 Зачет практики + Сертификат</span>
    }
    return <span className="badge badge-reward-other">💼 Стажировка / Оффер</span>
  }

  const getComplexityClass = (complexity: string) => {
    if (complexity === 'Начальный') return 'badge-complexity-low'
    if (complexity === 'Средний') return 'badge-complexity-medium'
    return 'badge-complexity-high'
  }

  const quickTechList = [
    { label: 'Все технологии', value: 'all' },
    { label: '🔥 Компьютерное зрение', value: 'Computer Vision' },
    { label: '⚡ React / Frontend', value: 'React' },
    { label: '🐍 Python / AI', value: 'Python' },
    { label: '⚙️ IoT / Микроконтроллеры', value: 'ESP32' },
    { label: '🐳 Docker / DevOps', value: 'Docker' },
    { label: '🔒 Безопасность', value: 'безопасност' },
  ]

  return (
    <div>
      {/* Top Banner & Title in Clean University Style */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0c1938', margin: 0, letterSpacing: '-0.02em' }}>
            {currentUser?.role === 'company' ? 'Мои ИТ-кейсы' : 'Витрина ИТ-проектов и кейсов предприятий'}
          </h1>
          <p style={{ fontSize: '12.5px', color: '#5e7188', margin: '4px 0 0' }}>
            Автоматизированная система проектного обучения УУНиТ • Евразийский НОЦ мирового уровня
          </p>
        </div>
        {canCreateCase && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreateModalOpen(true)}>
            <Plus size={15} /> Разместить кейс предприятия
          </button>
        )}
      </div>

      {/* UUST Schedule-Style Filter Container (Authorial Upgrade of ISU widget) */}
      <div className="uust-container">
        <div className="uust-tabs-row">
          <button
            className={`uust-tab ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => setActiveTab('cases')}
          >
            <Briefcase size={14} /> Все кейсы
          </button>
          <button
            className={`uust-tab ${activeTab === 'recruiting' ? 'active' : ''}`}
            onClick={() => setActiveTab('recruiting')}
          >
            <Building2 size={14} /> Открыт набор
          </button>
          <button
            className="uust-tab"
            onClick={() => navigate('/student-projects')}
          >
            <FolderGit2 size={14} /> По проектам студентов
          </button>
        </div>

        <div className="uust-box">
          {/* Row 1: Search input */}
          <div className="uust-filter-row">
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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
                placeholder="Поиск по названию задачи, компании или стеку (React, Python, Computer Vision, Go)..."
              />
            </div>
          </div>

          {/* Row 2: Clean dropdowns like on photo */}
          <div className="uust-filter-row">
            <select
              className="uust-select"
              style={{ flex: 1, minWidth: '200px' }}
              aria-label="Направление разработки"
              value={filters.direction}
              onChange={(e) => handleFilterChange('direction', e.target.value)}
            >
              <option value="all">Все направления разработки</option>
              <option value="Искусственный интеллект">Искусственный интеллект & ML (ИИМР)</option>
              <option value="Компьютерное зрение">Компьютерное зрение (ИИМР)</option>
              <option value="Мобильная разработка">Мобильная разработка</option>
              <option value="Frontend">Frontend-разработка</option>
              <option value="Backend">Backend и микросервисы</option>
              <option value="Информационная безопасность">Информационная безопасность</option>
              <option value="IoT">IoT и робототехника (ИАТМ)</option>
            </select>

            <select
              className="uust-select"
              style={{ width: '140px' }}
              value={filters.complexity}
              onChange={(e) => handleFilterChange('complexity', e.target.value)}
            >
              <option value="all">Курс: Все</option>
              <option value="Начальный">1–2 курс</option>
              <option value="Средний">3 курс</option>
              <option value="Высокий">4 курс / Маг.</option>
            </select>

            <select
              className="uust-select"
              style={{ flex: 1, minWidth: '180px' }}
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
              style={{ flex: 1, minWidth: '150px' }}
              value={filters.workFormat}
              onChange={(e) => handleFilterChange('workFormat', e.target.value)}
            >
              <option value="all">Формат: Все</option>
              <option value="дистанционный">Дистанционный</option>
              <option value="смешанный">Смешанный</option>
              <option value="очный">Очный (в лаборатории УУНиТ)</option>
            </select>
          </div>

          {/* Row 3: Semester pills matching the screenshot */}
          <div className="uust-pills-row">
            <button
              className={`uust-pill ${selectedPeriod === 'sem1' ? 'active' : ''}`}
              onClick={() => setSelectedPeriod('sem1')}
            >
              Осенний семестр
            </button>
            <button
              className={`uust-pill ${selectedPeriod === 'sem2' ? 'active' : ''}`}
              onClick={() => setSelectedPeriod('sem2')}
            >
              Весенний семестр
            </button>
            <button
              className={`uust-pill ${selectedPeriod === 'year' ? 'active' : ''}`}
              onClick={() => setSelectedPeriod('year')}
            >
              За учебный год
            </button>
            <button
              className={`uust-pill ${selectedPeriod === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedPeriod('all')}
            >
              Все периоды ({visibleCasesFor(currentUser, casesList).length})
            </button>

            <button
              className={`uust-pill ${filters.hasReward ? 'active' : ''}`}
              onClick={() => handleFilterChange('hasReward', !filters.hasReward)}
              style={{ marginLeft: 'auto' }}
            >
              💰 Только с оплатой / призом
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

      {/* Quick Technology Chips */}
      <div className="quick-tag-bar">
        {quickTechList.map((t) => (
          <button
            key={t.value}
            className={`quick-chip ${selectedQuickTech === t.value ? 'active' : ''}`}
            onClick={() => handleQuickTechClick(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section Subheader matching photo "Группа ТОП-204Б(73) Неделя 7" */}
      <div className="uust-section-title">
        <div>
          <span>Найдено кейсов: <strong>{visibleCases.length}</strong> из {visibleCasesFor(currentUser, casesList).length}</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#627282' }}>
          Учебный год: {academicYear}/{academicYear + 1} • По дате публикации
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <label>Сортировать: {' '}
          <select className="uust-select" value={sort} onChange={(e) => setSort(e.target.value as ShowcaseSort)}>
            <option value="newest">Сначала новые</option>
            <option value="deadline">Ближайший дедлайн</option>
            <option value="popular">По количеству заявок</option>
          </select>
        </label>
      </div>
      {/* Case Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          Загрузка витрины кейсов...
        </div>
      ) : error ? (
        <div className="card" role="alert" style={{ padding: 24 }}>
          <h3>Не удалось загрузить кейсы</h3>
          <p>{error}</p>
          <button className="btn btn-primary btn-sm" onClick={() => dispatch(fetchCasesRequest(filters))}>Повторить загрузку</button>
        </div>
      ) : visibleCases.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <FolderGit2 size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Кейсы не найдены</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
            По заданным фильтрам проектов не найдено. Попробуйте сбросить фильтры.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleResetFilters} style={{ margin: '0 auto' }}>
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="case-grid">
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

                {currentUser?.role === 'student' && <button
                  className={`case-card__fav-btn ${isFav ? 'favorited' : ''}`}
                  onClick={(e) => handleToggleFav(e, item.id)}
                  aria-pressed={isFav}
                  title={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
                >
                  <Bookmark size={15} fill={isFav ? '#e04646' : 'none'} />
                </button>}

                <div className="card__body">
                  <div className="case-card__company">
                    <img src={item.companyLogo || 'https://via.placeholder.com/36'} alt={item.companyName} />
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

                  <div className="case-card__tags">
                    <span className="badge badge-direction">{item.direction}</span>
                    <span className={`badge ${getComplexityClass(item.complexity)}`}>{item.complexity}</span>
                    {item.isConfidential && (
                      <span className="badge badge-confidential">
                        <FileLock2 size={12} /> NDA
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: '14px' }}>{getRewardBadge(item)}</div>

                  <div className="case-card__meta-grid">
                    <div className="meta-item">
                      <Calendar size={13} />
                      <span>
                        Дедлайн: <strong>{new Date(item.deadlineDate).toLocaleDateString('ru-RU')}</strong>
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
        </div>
      )}

      {/* Modal for creating a new case */}
      <CreateCaseModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  )
}
