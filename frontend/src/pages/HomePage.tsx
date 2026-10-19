import React, { useState } from 'react'
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
  const { casesList } = useAppSelector((state) => state.cases)
  const { studentsList: authors } = useAppSelector((state) => state.students)
  const { projectsList } = useAppSelector((state) => state.studentProjects)
  const { companiesList } = useAppSelector((state) => state.companies)
  const { currentUser } = useAppSelector((state) => state.auth)
  const { applicationsList: allApplications } = useAppSelector((state) => state.applications)

  const [createModalOpen, setCreateModalOpen] = useState(false)

  const role = currentUser?.role || 'student'

  // Company specific data
  const companyName = currentUser?.companyProfile?.companyName || 'БашНефтеАвтоматика'
  const companyId = currentUser?.companyProfile?.companyId || 'comp_1'
  const myCompanyCases = casesList.filter((c) => c.companyId === companyId)

  const applicationsList = role === 'company' ? allApplications.filter((app) => app.companyId === companyId) : allApplications

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
            <span>Кабинет индустриального партнера • Евразийский НОЦ мирового уровня</span>
          </div>

          <h1 className="home-hero__title">
            {companyName}
          </h1>

          <p className="home-hero__subtitle">
            Управление технологическими кейсами предприятия, рассмотрение заявок от студентов УУНиТ, 
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
              <Search size={15} /> Поиск талантов УУНиТ
            </Link>
            <Link to={`/company/${companyId}`} className="btn btn-coral">
              <Building2 size={15} /> Карточка компании
            </Link>
          </div>
        </div>

        {/* Company KPI Stats */}
        <div className="home-stats-grid">
          <div className="stat-card">
            <div className="stat-card__icon stat-icon--blue">
              <Briefcase size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{myCompanyCases.filter((project) => project.status === 'open').length}</div>
              <div className="stat-label">Кейсов предприятия</div>
              <div className="stat-meta">В открытом наборе</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--emerald">
              <Users size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{applicationsList.filter((app) => app.status === 'pending').length}</div>
              <div className="stat-label">Заявок студентов</div>
              <div className="stat-meta">Требуют рассмотрения</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--amber">
              <Layers size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{myCompanyCases.filter((project) => project.status === 'in_progress').length}</div>
              <div className="stat-label">Проекты в разработке</div>
              <div className="stat-meta">На стадии MVP / вех</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--purple">
              <Award size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{myCompanyCases.filter((project) => project.status === 'completed').length}</div>
              <div className="stat-label">Завершенных проектов</div>
              <div className="stat-meta">Принятых заявок: {applicationsList.filter((app) => app.status === 'accepted').length}</div>
            </div>
          </div>
        </div>

        {/* Section: Company's Cases */}
        <div className="home-section">
          <div className="home-section__header">
            <div>
              <h2>Кейсы вашего предприятия</h2>
              <p>Задачи, опубликованные вашей компанией для студентов кафедр УУНиТ</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateModalOpen(true)}>
              <Plus size={14} /> Добавить задачу
            </button>
          </div>

          <div className="case-grid">
            {myCompanyCases.map((c) => (
              <div key={c.id} className="case-card">
                <div className="case-card__top-accent" />
                <div className="card__body">
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <span className="badge badge-direction">{c.direction}</span>
                    <span className="badge badge-complexity-medium">{c.complexity}</span>
                  </div>

                  <h3 className="case-card__title">
                    <Link to={`/cases/${c.id}`}>{c.title}</Link>
                  </h3>

                  <p className="case-card__desc">{c.shortDescription}</p>

                  <div className="case-card__meta-grid">
                    <div className="meta-item">
                      <Calendar size={13} />
                      <span>Дедлайн: <strong>{new Date(c.deadlineDate).toLocaleDateString('ru-RU')}</strong></span>
                    </div>
                    <div className="meta-item">
                      <Users size={13} />
                      <span>Команда: <strong>{c.teamSize.min}–{c.teamSize.max} чел.</strong></span>
                    </div>
                  </div>
                </div>

                <div className="case-card__footer-bar">
                  <span style={{ fontSize: '11px', color: '#627282' }}>
                    Заявок: <strong>{c.applicationsCount}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link to={`/cases/${c.id}/workspace`} className="btn btn-secondary btn-sm">
                      <Layers size={13} /> Рабочая станция
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
              <h2>Свежие заявки от студентов УУНиТ</h2>
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
                {applicationsList.slice(0, 4).map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={app.studentAvatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                          alt=""
                          style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#0c1938' }}>{app.studentName}</div>
                          <div style={{ fontSize: '11px', color: '#627282' }}>{app.studentEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{app.studentInstitute}</div>
                      <div style={{ fontSize: '11px', color: '#627282' }}>{app.studentCourse} курс</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {app.caseTitle}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-status status-open">
                        {app.status === 'accepted' ? 'Принят' : app.status === 'rejected' ? 'Отклонен' : 'На рассмотрении'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => dispatch(updateApplicationStatusRequest(app.id, 'accepted'))}
                        >
                          Принять
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => dispatch(updateApplicationStatusRequest(app.id, 'rejected'))}
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
    return (
      <div className="home-page">
        <div className="home-hero">
          <div className="home-hero__badge">
            <GraduationCap size={13} />
            <span>Кабинет куратора кафедры • УУНиТ</span>
          </div>

          <h1 className="home-hero__title">
            Координация проектного обучения кафедры
          </h1>

          <p className="home-hero__subtitle">
            Мониторинг студенческих команд группы ТОП-204Б(73), контроль прохождения этапов производственной практики 
            и взаимодействие с аккредитованными предприятиями Евразийского НОЦ.
          </p>

          <div className="home-hero__actions">
            <Link to="/cases/case_1/workspace" className="btn btn-primary">
              <Layers size={15} /> Мониторинг рабочей станции
            </Link>
            <Link to="/students-search" className="btn btn-secondary">
              <Search size={15} /> Студенты и группы
            </Link>
            <Link to="/analytics" className="btn btn-coral">
              <Award size={15} /> Успеваемость и защиты
            </Link>
          </div>
        </div>

        <div className="home-stats-grid">
          <div className="stat-card">
            <div className="stat-card__icon stat-icon--blue">
              <Users size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">48</div>
              <div className="stat-label">Студентов на практике</div>
              <div className="stat-meta">Группы ТОП-204Б, ПИ-301</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--emerald">
              <Layers size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">14</div>
              <div className="stat-label">Проектных команд</div>
              <div className="stat-meta">В активной разработке</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--purple">
              <FileCheck2 size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">36</div>
              <div className="stat-label">Сданных вех</div>
              <div className="stat-meta">ТЗ, MVP, Архитектура</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-icon--amber">
              <Award size={22} />
            </div>
            <div className="stat-card__content">
              <div className="stat-number">{myCompanyCases.filter((project) => project.status === 'completed').length}</div>
              <div className="stat-label">Защищенных решений</div>
              <div className="stat-meta">С зачетом практики</div>
            </div>
          </div>
        </div>

        {/* Curator Groups Overview */}
        <div className="home-section">
          <div className="home-section__header">
            <div>
              <h2>Проектные команды на контроле куратора</h2>
              <p>Текущий прогресс выполнения 7 контрольных точек проектного обучения</p>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Группа / Команда</th>
                  <th>Кейс предприятия</th>
                  <th>Тимлид команды</th>
                  <th>Прогресс по вехам</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>ТОП-204Б(73) • Команда «NeuralFlow»</strong>
                    <div style={{ fontSize: '11px', color: '#627282' }}>4 студента • ИИМР</div>
                  </td>
                  <td>Дефектоскопия лопаток турбин (ПАО ОДК-УМПО)</td>
                  <td>Магасумов Алмаз</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, background: '#e2e8f0', height: '6px', borderRadius: '3px', width: '100px' }}>
                        <div style={{ width: '57%', height: '100%', background: '#3a75b4', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>4 из 7</span>
                    </div>
                  </td>
                  <td>
                    <Link to="/cases/case_1/workspace" className="btn btn-secondary btn-sm">
                      Просмотр вех
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>ПИ-301Б • Команда «SmartAgro»</strong>
                    <div style={{ fontSize: '11px', color: '#627282' }}>3 студента • ИИМР</div>
                  </td>
                  <td>Мониторинг посевов по спутниковым снимкам</td>
                  <td>Саитов Руслан</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, background: '#e2e8f0', height: '6px', borderRadius: '3px', width: '100px' }}>
                        <div style={{ width: '42%', height: '100%', background: '#28a745', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>3 из 7</span>
                    </div>
                  </td>
                  <td>
                    <Link to="/cases/case_1/workspace" className="btn btn-secondary btn-sm">
                      Просмотр вех
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  /* ========================================================================= */
  /*  VIEW FOR STUDENT (Matching Screenshots from Real ISU UUST)               */
  /* ========================================================================= */
  const activeCases = casesList.slice(0, 3)
  const featuredProjects = projectsList.slice(0, 3)

  return (
    <div className="home-page">
      {/* Official ISU Welcome Banner matching user's Image 2 */}
      <div style={{ background: '#ffffff', border: '1px solid #dce4ed', borderRadius: '8px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(11,23,54,0.04)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1a2233', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          Добро пожаловать в информационную систему университета!
        </h1>
        <p style={{ fontSize: '13px', color: '#5e7188', margin: 0, lineHeight: 1.55 }}>
          Данная система является комплексным решением для обеспечения деятельности структурных подразделений УУНиТ 
          и платформой взаимодействия студентов с индустриальными предприятиями.
        </p>
      </div>

      {/* Split Screen matching Image 2: Schedule on Left, Student News on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Left: Schedule Table from user screenshot */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ed', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(11,23,54,0.04)' }}>
          <div style={{ background: '#e68a19', color: '#ffffff', padding: '10px 16px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Расписание группы ТОП-204Б(73)</span>
            <span style={{ fontSize: '11px', fontWeight: 500 }}>Неделя 7 (нечетная)</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Время</th>
                  <th>Понедельник</th>
                  <th>Вторник</th>
                  <th>Среда</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, color: '#627282' }}>08:00–09:20</td>
                  <td style={{ background: '#edf6ff' }}>
                    <strong>Проектная деятельность (Лекция)</strong>
                    <div style={{ fontSize: '10.5px', color: '#5e7188' }}>Сазонова Е.Ю. • Корпус 9-401</div>
                  </td>
                  <td style={{ background: '#f0fdf4' }}>
                    <strong>Системное ПО</strong>
                    <div style={{ fontSize: '10.5px', color: '#5e7188' }}>Мануилов М.Ю. • Корпус 6-211</div>
                  </td>
                  <td>—</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#627282' }}>09:35–10:55</td>
                  <td style={{ background: '#edf6ff' }}>
                    <strong>Работа над ИТ-кейсом</strong>
                    <div style={{ fontSize: '10.5px', color: '#5e7188' }}>Лаборатория ИИМР УУНиТ</div>
                  </td>
                  <td>—</td>
                  <td style={{ background: '#fdf4ff' }}>
                    <strong>Архитектура систем</strong>
                    <div style={{ fontSize: '10.5px', color: '#5e7188' }}>Макеев Г.А. • Корпус 6-202</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Student News from user screenshot */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ed', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(11,23,54,0.04)' }}>
          <div style={{ background: '#3a75b4', color: '#ffffff', padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}>
            Новостная лента студентов УУНиТ
          </div>

          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', color: '#3a75b4', fontWeight: 700 }}>🚀 ХАКАТОНЫ И ГРАНТЫ • 15.10.2026</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0c1938', marginTop: '2px' }}>
                Открыт прием заявок на студенческий акселератор Евразийского НОЦ с призовым фондом 1.85 млн ₽
              </div>
            </div>

            <div style={{ paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', color: '#e68a19', fontWeight: 700 }}>🏢 ИНДУСТРИЯ • 12.10.2026</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0c1938', marginTop: '2px' }}>
                ПАО «ОДК-УМПО» и БашНефтеАвтоматика разместили новые производственные кейсы для кафедры ИИМР
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#28a745', fontWeight: 700 }}>🎓 ПРАКТИКА • 09.10.2026</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0c1938', marginTop: '2px' }}>
                Успешное решение кейса дает автоматический зачет производственной практики в 7 семестре
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="home-stats-grid">
        <div className="stat-card">
          <div className="stat-card__icon stat-icon--blue">
            <Briefcase size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">{casesList.length || 18}</div>
            <div className="stat-label">Кейсов от предприятий</div>
            <div className="stat-meta">Открыт прием заявок</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-icon--emerald">
            <Rocket size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">{projectsList.length || 42}</div>
            <div className="stat-label">Студенческих стартапов</div>
            <div className="stat-meta">Pet-проекты, ВКР, хакатоны</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-icon--purple">
            <Building2 size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">{companiesList.length || 12}</div>
            <div className="stat-label">Партнёров в реестре</div>
            <div className="stat-meta">Верифицированные компании</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-icon--amber">
            <Award size={22} />
          </div>
          <div className="stat-card__content">
            <div className="stat-number">1.85 млн ₽</div>
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
            Все кейсы ({casesList.length}) <ArrowRight size={14} />
          </Link>
        </div>

        <div className="case-grid">
          {activeCases.map((c) => (
            <div key={c.id} className="case-card">
              <div className="case-card__top-accent" />
              <div className="card__body">
                <div className="case-card__company">
                  <img src={c.companyLogo || 'https://via.placeholder.com/36'} alt="" />
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
                  <span className="badge badge-direction">{c.direction}</span>
                  <span className="badge badge-complexity-medium">{c.complexity}</span>
                </div>

                <div className="case-card__meta-grid">
                  <div className="meta-item">
                    <Calendar size={13} />
                    <span>Дедлайн: <strong>{new Date(c.deadlineDate).toLocaleDateString('ru-RU')}</strong></span>
                  </div>
                  <div className="meta-item">
                    <Users size={13} />
                    <span>Команда: <strong>{c.teamSize.min}–{c.teamSize.max} чел.</strong></span>
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
            <p>Pet-проекты, победители хакатонов и стартапы студентов УУНиТ</p>
          </div>
          <Link to="/student-projects" className="home-section__link">
            Все проекты ({projectsList.length}) <ArrowRight size={14} />
          </Link>
        </div>

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
                    <div className="author-name">👤 {authors.find((author) => author.id === p.authorId)?.fullName || p.authorName}</div>
                    <div className="author-group">{p.teamName || 'Студент УУНиТ • ТОП-204Б(73)'}</div>
                  </div>
                  <Link to={`/student-projects/${p.id}`} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
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
