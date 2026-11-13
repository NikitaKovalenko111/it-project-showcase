import { complexityBadge } from '../utils/publication'
import { PaginatedGrid } from '../components/PaginatedGrid'
import { IdentityImage } from '../components/IdentityImage'
import { caseStatusLabels } from '../utils/publication'
import { apiRuntime } from '../api/runtime'
import { listCuratedExecutions } from '../api/community'
import { formatDate } from '../utils/date'
import { isPublished, publicationLabels, publicationStatus } from '../utils/publication'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { updateApplicationStatusRequest } from '../store/actions'
import { CreateCaseModal } from '../components/modals/CreateCaseModal'
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Cpu,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  FolderGit2,
  Globe,
  GraduationCap,
  Layers,
  Plus,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Users,
  XCircle,
} from 'lucide-react'

export const HomePage: React.FC = () => {
  const dispatch = useAppDispatch()
  const {
    casesList,
    loading: casesLoading,
    error: casesError,
  } = useAppSelector((state) => state.cases)
  const {
    studentsList: authors,
    loading: studentsLoading,
    error: studentsError,
  } = useAppSelector((state) => state.students)
  const { projectsList } = useAppSelector((state) => state.studentProjects)
  const { companiesList } = useAppSelector((state) => state.companies)
  const { currentUser } = useAppSelector((state) => state.auth)
  const {
    applicationsList: allApplications,
    loading: applicationsLoading,
    error: applicationsError,
  } = useAppSelector((state) => state.applications)

  const [createModalOpen, setCreateModalOpen] = useState(false)

  const [curated, setCurated] = useState<Awaited<ReturnType<typeof listCuratedExecutions>>>()
  const [curatedError, setCuratedError] = useState('')
  useEffect(() => {
    setCurated(undefined)
    setCuratedError('')
    if (currentUser?.role !== 'curator' || apiRuntime.mode !== 'live') return
    let active = true
    listCuratedExecutions()
      .then((items) => {
        if (active) setCurated(items)
      })
      .catch((e: Error) => {
        if (active) setCuratedError(e.message)
      })
    return () => {
      active = false
    }
  }, [currentUser?.id, currentUser?.role])

  const role = currentUser?.role || 'student'

  // Company specific data
  const companyName = currentUser?.companyProfile?.companyName || 'Кабинет компании'
  const companyId = currentUser?.companyProfile?.companyId
  const myCompanyCases = casesList.filter((c) => c.companyId === companyId)

  const applicationsList =
    role === 'company'
      ? allApplications.filter((app) => app.companyId === companyId)
      : allApplications

  /* ========================================================================= */
  /*  VIEW FOR COMPANY                                                         */
  /* ========================================================================= */
  if (role === 'company') {
    return (
      <div className="home-page">
        {/* Company Dashboard Hero */}
        <div className="home-hero">
          <div className="home-hero__badge">
            <Building2 size={13} />
            <span>Кабинет индустриального партнера</span>
          </div>

          <h1 className="home-hero__title">{companyName}</h1>

          <p className="home-hero__subtitle">
            Управление технологическими кейсами предприятия, рассмотрение заявок от студентов,
            формирование проектных команд и отбор перспективных ИТ-специалистов.
          </p>

          <div className="home-hero__actions">
            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
              <Plus size={15} /> Разместить новый кейс
            </button>
            <Link to="/company-applications" className="btn btn-secondary">
              <Users size={15} /> Входящие заявки студентов ({applicationsList.length})
            </Link>
            <Link to="/students-search" className="btn btn-secondary">
              <Search size={15} /> Поиск талантов
            </Link>
            {companyId && (
              <Link to={`/company/${companyId}`} className="btn btn-coral">
                <Building2 size={15} /> Карточка компании
              </Link>
            )}
          </div>
        </div>

        {/* Company KPI Stats */}
        <div className="home-stats-grid">
          <div className="stat-card">
            <div className="stat-card__icon stat-icon--blue">
              <Briefcase size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{myCompanyCases.filter(isPublished).length}</div>
              <div className="stat-label">Кейсов предприятия</div>
              <div className="stat-meta">Опубликовано</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--emerald">
              <Users size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{applicationsList.length}</div>
              <div className="stat-label">Заявок студентов</div>
              <div className="stat-meta">
                На рассмотрении: {applicationsList.filter((app) => app.status === 'pending').length}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--amber">
              <Layers size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">
                {myCompanyCases.filter((project) => project.status === 'in_progress').length}
              </div>
              <div className="stat-label">Проекты в разработке</div>
              <div className="stat-meta">На стадии MVP / вех</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--purple">
              <Award size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">
                {myCompanyCases.filter((project) => project.status === 'completed').length}
              </div>
              <div className="stat-label">Завершенных проектов</div>
              <div className="stat-meta">
                Принятых заявок:{' '}
                {applicationsList.filter((app) => app.status === 'accepted').length}
              </div>
            </div>
          </div>
        </div>

        {/* Section: Company's Cases */}
        <div className="home-section">
          <div className="home-section__header">
            <div>
              <h2>Кейсы вашего предприятия</h2>
              <p>Задачи, опубликованные вашей компанией для студентов кафедр</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateModalOpen(true)}>
              <Plus size={14} /> Разместить новый кейс
            </button>
          </div>

          <div className="case-grid">
            {myCompanyCases.map((c) => (
              <div key={c.id} className="case-card">
                <div className="case-card__top-accent" />
                <div className="card__body">
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {c.direction && <span className="badge badge-direction">{c.direction}</span>}
                    <span className={`badge ${complexityBadge(c.complexity)}`}>
                      Уровень: {c.complexity.toLowerCase()}
                    </span>
                    {!isPublished(c) && (
                      <span className={`badge publication-${publicationStatus(c)}`}>
                        {publicationLabels[publicationStatus(c)]}
                      </span>
                    )}
                  </div>

                  <h3 className="case-card__title">
                    <Link to={`/cases/${c.id}`}>{c.title}</Link>
                  </h3>

                  <p className="case-card__desc">{c.shortDescription}</p>

                  <div className="case-card__meta-grid">
                    <div className="meta-item">
                      <Calendar size={13} />
                      <span>
                        Дедлайн: <strong>{formatDate(c.deadlineDate)}</strong>
                      </span>
                    </div>
                    <div className="meta-item">
                      <Users size={13} />
                      <span>
                        Команда:{' '}
                        <strong>
                          {c.teamSize.min === c.teamSize.max
                            ? c.teamSize.min
                            : `${c.teamSize.min}–${c.teamSize.max}`}{' '}
                          чел.
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="case-card__footer-bar">
                  <span style={{ fontSize: '11px', color: '#627282' }}>
                    Заявок: <strong>{c.applicationsCount}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link to={`/cases/${c.id}/workspace`} className="btn btn-secondary btn-sm">
                      <Layers size={13} /> Активные проекты
                    </Link>
                    <Link to={`/cases/${c.id}`} className="btn btn-primary btn-sm">
                      ТЗ кейса →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Recent Applications */}
        <div className="home-section" style={{ marginTop: '24px' }}>
          <div className="home-section__header">
            <div>
              <h2>Свежие заявки от студентов</h2>
              <p>Студенты, подавшие резюме и мотивационные письма на решение ваших задач</p>
            </div>
            <Link to="/company-applications" className="home-section__link">
              Все заявки ({applicationsList.length}) <ArrowRight size={14} />
            </Link>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Студент</th>
                  <th>Группа / Институт</th>
                  <th>Кейс предприятия</th>
                  <th>Статус заявки</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {applicationsError && (
                  <tr>
                    <td colSpan={5} role="alert">
                      {applicationsError}
                    </td>
                  </tr>
                )}
                {!applicationsList.some(
                  (app) => app.status === 'pending' || app.status === 'need_info',
                ) && (
                  <tr>
                    <td colSpan={5}>
                      Новых заявок нет. Обработанные заявки доступны в разделе «Заявки студентов».
                    </td>
                  </tr>
                )}
                {applicationsList
                  .filter((app) => app.status === 'pending' || app.status === 'need_info')
                  .slice(0, 4)
                  .map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IdentityImage
                            src={app.studentAvatar}
                            name={app.studentName}
                            className="candidate-avatar"
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0c1938' }}>
                              <Link className="profile-link" to={`/profile/${app.studentId}`}>
                                {app.studentName}
                              </Link>
                            </div>
                            <div style={{ fontSize: '11px', color: '#627282' }}>
                              {app.studentEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{app.studentInstitute}</div>
                        <div style={{ fontSize: '11px', color: '#627282' }}>
                          {app.studentCourse} курс
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            fontWeight: 600,
                            maxWidth: '240px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {app.caseTitle}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-status status-open">
                          {app.status === 'accepted'
                            ? 'Принят'
                            : app.status === 'rejected'
                              ? 'Отклонен'
                              : 'На рассмотрении'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-success btn-sm"
                            disabled={applicationsLoading}
                            onClick={() =>
                              dispatch(updateApplicationStatusRequest(app.id, 'accepted'))
                            }
                          >
                            Принять
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={applicationsLoading}
                            onClick={() =>
                              dispatch(updateApplicationStatusRequest(app.id, 'rejected'))
                            }
                          >
                            Отклонить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <CreateCaseModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      </div>
    )
  }

  /* ========================================================================= */
  /*  VIEW FOR CURATOR                                                         */
  /* ========================================================================= */
  if (role === 'curator') {
    const students = authors.filter(
      (student) =>
        student.role === 'student' && student.studentProfile?.curatorId === currentUser?.id,
    )
    const groups = new Set(students.map((student) => student.studentProfile?.group).filter(Boolean))
    const curatedCaseIds = new Set(curated?.map((item) => item.case_id))
    const projects = casesList.filter((project) =>
      apiRuntime.mode === 'live'
        ? curatedCaseIds.has(project.id)
        : project.curatorId === currentUser?.id ||
          students.some((student) => student.id === project.assignedStudentId),
    )
    return (
      <div className="home-page">
        <div className="home-hero">
          <div className="home-hero__badge">
            <GraduationCap size={13} /> Кабинет куратора кафедры
          </div>
          <h1 className="home-hero__title">Координация проектного обучения кафедры</h1>
          <div className="home-hero__actions">
            <Link to="/workspace" className="btn btn-primary">
              <Layers size={15} /> Мониторинг проектов
            </Link>
            <Link to="/students-search" className="btn btn-secondary">
              <Search size={15} /> Студенты и группы
            </Link>
          </div>
        </div>
        <div className="home-stats-grid curator-stats" aria-label="Сводка куратора">
          {[
            {
              label: 'Закреплённые студенты',
              value:
                apiRuntime.mode === 'live' || studentsError
                  ? '—'
                  : studentsLoading
                    ? '…'
                    : students.length,
              Icon: GraduationCap,
              tone: 'blue',
            },
            {
              label: 'Учебные группы',
              value:
                apiRuntime.mode === 'live' || studentsError
                  ? '—'
                  : studentsLoading
                    ? '…'
                    : groups.size,
              Icon: Users,
              tone: 'emerald',
            },
            {
              label: 'Проекты под наблюдением',
              value:
                curatedError || casesError
                  ? '—'
                  : casesLoading || (apiRuntime.mode === 'live' && !curated)
                    ? '…'
                    : projects.length,
              Icon: Layers,
              tone: 'purple',
            },
          ].map(({ label, value, Icon, tone }) => (
            <div className="stat-card" key={label}>
              <div className={`stat-card__icon stat-icon--${tone}`}>
                <Icon size={22} />
              </div>
              <div className="stat-card__content">
                <div className="stat-number">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>
        <section className="home-section">
          <div className="home-section__header">
            <div>
              <h2>Очереди модерации</h2>
              <p>Публикации компаний и студенческие работы</p>
            </div>
          </div>
          <div className="curator-review-links">
            <Link className="card curator-review-link" to="/companies?review=cases">
              <Briefcase size={20} /> Кейсы и мероприятия <ArrowRight size={16} />
            </Link>
            <Link className="card curator-review-link" to="/companies?review=opportunities">
              <GraduationCap size={20} /> Стажировки и практики <ArrowRight size={16} />
            </Link>
            <Link className="card curator-review-link" to="/student-projects?review=student">
              <FileCheck2 size={20} /> Проекты студентов <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="home-section">
          <div className="home-section__header">
            <div>
              <h2>Проекты закреплённых студентов</h2>
              <p>Откройте проект, чтобы посмотреть контрольные точки и комментарии.</p>
            </div>
            <Link to="/workspace" className="home-section__link">
              Все проекты <ArrowRight size={15} />
            </Link>
          </div>
          {curatedError || casesError ? (
            <p role="alert">{curatedError || casesError}</p>
          ) : casesLoading || (apiRuntime.mode === 'live' && !curated) ? (
            <p role="status">Загрузка проектов…</p>
          ) : !projects.length ? (
            <p className="card empty-state">У закреплённых студентов пока нет проектов.</p>
          ) : (
            <PaginatedGrid className="case-grid curator-projects" paginationKey="curatorProjects">
              {projects.map((project) => (
                <article className="case-card" key={project.id}>
                  <div className="case-card__top-accent" />
                  <div className="card__body">
                    <div className="case-card__tags">
                      <span className="badge badge-direction">
                        {
                          {
                            case: 'Кейс',
                            hackathon: 'Хакатон',
                            olympiad: 'Олимпиада',
                            internship: 'Стажировка',
                          }[project.kind || 'case']
                        }
                      </span>
                      <span className="badge badge-status">
                        {caseStatusLabels[project.status] || project.status}
                      </span>
                    </div>
                    <h3 className="case-card__title">{project.title}</h3>
                    <div className="case-card__company">
                      <Building2 size={15} /> {project.companyName}
                    </div>
                    {project.deadlineDate && (
                      <p className="curator-project-date">
                        <Calendar size={15} /> Срок: {formatDate(project.deadlineDate)}
                      </p>
                    )}
                  </div>
                  <div className="case-card__footer-bar">
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={`/cases/${project.id}/workspace`}
                    >
                      К мониторингу <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              ))}
            </PaginatedGrid>
          )}
        </section>
      </div>
    )
  }

  /* ========================================================================= */
  /*  VIEW FOR STUDENT (Matching Screenshots from Real ISU UUST)               */
  /* ========================================================================= */
  const publishedCases = casesList.filter(isPublished)
  const activeCases = publishedCases.slice(0, 3)
  const featuredProjects = projectsList.filter(isPublished).slice(0, 3)

  return (
    <div className="home-page">
      {/* Official ISU Welcome Banner matching user's Image 2 */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #dce4ed',
          borderRadius: '8px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px rgba(11,23,54,0.04)',
        }}
      >
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#1a2233',
            margin: '0 0 6px',
            letterSpacing: '-0.01em',
          }}
        >
          Добро пожаловать в информационную систему университета!
        </h1>
        <p style={{ fontSize: '13px', color: '#5e7188', margin: 0, lineHeight: 1.55 }}>
          Данная система является комплексным решением для обеспечения деятельности структурных
          подразделений и платформой взаимодействия студентов с индустриальными предприятиями.
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="home-stats-grid">
        <div className="stat-card">
          <div className="stat-card__icon stat-icon--blue">
            <Briefcase size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">{publishedCases.length}</div>
            <div className="stat-label">Кейсов от предприятий</div>
            <div className="stat-meta">На витрине</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-icon--emerald">
            <Rocket size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">{projectsList.length}</div>
            <div className="stat-label">Студенческих стартапов</div>
            <div className="stat-meta">Pet-проекты, ВКР, хакатоны</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-icon--purple">
            <Building2 size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">{companiesList.length}</div>
            <div className="stat-label">Партнёров в реестре</div>
            <div className="stat-meta">Верифицированные компании</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-icon--amber">
            <Award size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">
              {casesList
                .reduce((sum, c) => sum + (c.prizeFund || c.rewardAmount || 0), 0)
                .toLocaleString('ru-RU')}{' '}
              ₽
            </div>
            <div className="stat-label">Призовой фонд семестра</div>
            <div className="stat-meta">Гранты, премии, офферы</div>
          </div>
        </div>
      </div>

      {/* Section 1: Active Cases */}
      <div className="home-section">
        <div className="home-section__header">
          <div>
            <h2>Актуальные кейсы от предприятий</h2>
            <p>Задачи от ведущих ИТ-компаний Башкортостана для командной разработки</p>
          </div>
          <Link to="/cases" className="home-section__link">
            Все кейсы ({publishedCases.length}) <ArrowRight size={14} />
          </Link>
        </div>

        {casesLoading && <p role="status">Загрузка актуальных кейсов…</p>}
        {casesError && <p role="alert">{casesError}</p>}
        {!casesLoading && !casesError && activeCases.length === 0 && (
          <p>Опубликованных кейсов пока нет.</p>
        )}
        <div className="case-grid">
          {activeCases.map((c) => (
            <div key={c.id} className="case-card">
              <div className="case-card__top-accent" />
              <div className="card__body">
                <div className="case-card__company">
                  <img src={c.companyLogo || '/demo/company.svg'} alt="" />
                  <div>
                    <div className="company-title">{c.companyName}</div>
                    <div className="company-sub">Индустриальный партнёр</div>
                  </div>
                  <span className="badge badge-verified" style={{ marginLeft: 'auto' }}>
                    <ShieldCheck size={11} /> Верифицирован
                  </span>
                </div>

                <h3 className="case-card__title">
                  <Link to={`/cases/${c.id}`}>{c.title}</Link>
                </h3>

                <p className="case-card__desc">{c.shortDescription}</p>

                <div className="case-card__tags">
                  {c.direction && <span className="badge badge-direction">{c.direction}</span>}
                  <span className={`badge ${complexityBadge(c.complexity)}`}>
                    Уровень: {c.complexity.toLowerCase()}
                  </span>
                </div>

                <div className="case-card__meta-grid">
                  <div className="meta-item">
                    <Calendar size={13} />
                    <span>
                      Дедлайн: <strong>{formatDate(c.deadlineDate)}</strong>
                    </span>
                  </div>
                  <div className="meta-item">
                    <Users size={13} />
                    <span>
                      Команда:{' '}
                      <strong>
                        {c.teamSize.min === c.teamSize.max
                          ? c.teamSize.min
                          : `${c.teamSize.min}–${c.teamSize.max}`}{' '}
                        чел.
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="case-card__footer-bar">
                <div style={{ fontSize: '11px', color: '#627282' }}>
                  Заявок: <strong>{c.applicationsCount}</strong>
                </div>
                <Link to={`/cases/${c.id}`} className="btn btn-primary btn-sm">
                  Подробнее о кейсе →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Student Projects Showcase */}
      <div className="home-section" style={{ marginTop: '24px' }}>
        <div className="home-section__header">
          <div>
            <h2>Витрина авторских проектов студентов</h2>
            <p>Pet-проекты, победители хакатонов и стартапы студентов</p>
          </div>
          <Link to="/student-projects" className="home-section__link">
            Все проекты ({projectsList.length}) <ArrowRight size={14} />
          </Link>
        </div>

        {featuredProjects.length === 0 && <p>Опубликованных студенческих проектов пока нет.</p>}
        <div className="case-grid">
          {featuredProjects.map((p) => (
            <div key={p.id} className="student-project-card">
              <div className="student-project-card__image-wrap">
                <img src={p.coverImage} alt={p.title} />
                <span className="category-tag">{p.category}</span>
                <span className="readiness-tag">{p.status}</span>
              </div>

              <div className="student-project-card__body">
                <h3 className="student-project-card__title">
                  <Link to={`/student-projects/${p.id}`}>{p.title}</Link>
                </h3>
                <p className="student-project-card__desc">{p.shortDescription}</p>

                <div className="student-project-card__author-row">
                  <div>
                    <div className="author-name">
                      <User size={14} aria-hidden="true" />{' '}
                      {authors.find((author) => author.id === p.authorId)?.fullName || p.authorName}
                    </div>
                    <div className="author-group">{p.teamName || 'Студенческий проект'}</div>
                  </div>
                  <Link
                    to={`/student-projects/${p.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 'auto' }}
                  >
                    Смотреть
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
