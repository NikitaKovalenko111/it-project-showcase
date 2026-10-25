import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCompanyByIdRequest } from '../store/actions'
import { CreateCaseModal } from '../components/modals/CreateCaseModal'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Code2,
  Edit3,
  ExternalLink,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Users,
} from 'lucide-react'

export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const { activeCompany, loading } = useAppSelector((state) => state.companies)
  const { casesList } = useAppSelector((state) => state.cases)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [isEditing, setIsEditing] = useState(false)
  const [description, setDescription] = useState('')
  const [activeTab, setActiveTab] = useState<'cases' | 'internships' | 'mentors'>('cases')
  const [createCaseModalOpen, setCreateCaseModalOpen] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCompanyByIdRequest(id))
    }
  }, [dispatch, id])

  useEffect(() => {
    if (activeCompany) {
      setDescription(activeCompany.description)
    }
  }, [activeCompany])

  if (loading || !activeCompany) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>Загрузка карточки компании...</div>
  }

  const isCompanyRepresentative =
    currentUser?.role === 'company' &&
    (currentUser?.companyProfile?.companyId === activeCompany.id || currentUser?.companyProfile?.companyName === activeCompany.name)

  const isCuratorOrAdmin =
    currentUser?.role === 'admin'

  const companyCases = casesList.filter((c) => c.companyId === activeCompany.id || c.companyName === activeCompany.name)

  return (
    <div>
      {/* Top back button & breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <Link to="/companies" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Все компании-партнёры
        </Link>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(isCompanyRepresentative || isCuratorOrAdmin) && (
            <button className="btn btn-primary btn-sm" onClick={() => setCreateCaseModalOpen(true)}>
              <Plus size={14} /> Разместить кейс от компании
            </button>
          )}
        </div>
      </div>

      {/* Authorial Company Hero Banner */}
      <div className="company-hero">
        <div className="company-hero__top">
          <img
            src={activeCompany.logo}
            alt={activeCompany.name}
            className="company-hero__logo"
          />

          <div className="company-hero__info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className="company-industry">
                <Building2 size={12} /> {activeCompany.industry}
              </span>
              {activeCompany.isVerified && (
                <span className="company-verified">
                  <ShieldCheck size={14} /> Аккредитовано
                </span>
              )}
            </div>

            <h1>{activeCompany.name}</h1>

            <div style={{ fontSize: '13px', color: '#b9d4f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Краткое наименование: <strong>{activeCompany.shortName}</strong></span>
              <span>•</span>
              <span>ИНН: 0274198273</span>
            </div>
          </div>

          {isCompanyRepresentative && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditing(!isEditing)}
              style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
            >
              <Edit3 size={14} /> {isEditing ? 'Отмена' : 'Редактировать описание'}
            </button>
          )}
        </div>

        <div className="company-hero__desc">
          {isEditing ? (
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '16px', borderRadius: '8px' }}>
              <textarea
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ minHeight: '90px', background: '#ffffff', color: '#1a2233' }}
              />
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={() => setIsEditing(false)}
                style={{ marginTop: '10px' }}
              >
                <Save size={14} /> Сохранить изменения
              </button>
            </div>
          ) : (
            <p style={{ margin: 0 }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="company-metrics-row">
        <div className="metric-card metric-card--blue">
          <div className="metric-value">{activeCompany.activeCasesCount || companyCases.length || 3}</div>
          <div className="metric-label">Активных кейсов в семестре</div>
        </div>

        <div className="metric-card metric-card--emerald">
          <div className="metric-value">{activeCompany.completedProjectsCount || 8}</div>
          <div className="metric-label">Успешно сданных проектов</div>
        </div>

        <div className="metric-card metric-card--amber">
          <div className="metric-value">16+</div>
          <div className="metric-label">Студентов на стажировке / в штате</div>
        </div>

        <div className="metric-card metric-card--coral">
          <div className="metric-value">3 года</div>
          <div className="metric-label">Сотрудничества с кафедрой ИИМР</div>
        </div>
      </div>

      {/* Contact Cards Grid */}
      <div className="company-contacts-grid">
        <div className="contact-card">
          <div className="contact-card__icon contact-card__icon--blue">
            <Globe size={18} />
          </div>
          <div className="contact-card__text">
            <div className="label">Официальный сайт</div>
            <div className="value">
              <a href={activeCompany.website} target="_blank" rel="noreferrer">
                {activeCompany.website.replace('https://', '')}
              </a>
            </div>
          </div>
        </div>

        <div className="contact-card">
          <div className="contact-card__icon contact-card__icon--emerald">
            <Mail size={18} />
          </div>
          <div className="contact-card__text">
            <div className="label">Email для заявок</div>
            <div className="value">
              <a href={`mailto:${activeCompany.email}`}>
                {activeCompany.email}
              </a>
            </div>
          </div>
        </div>

        <div className="contact-card">
          <div className="contact-card__icon contact-card__icon--amber">
            <Phone size={18} />
          </div>
          <div className="contact-card__text">
            <div className="label">Телефон координатора</div>
            <div className="value">{activeCompany.phone}</div>
          </div>
        </div>

        <div className="contact-card">
          <div className="contact-card__icon contact-card__icon--purple">
            <User size={18} />
          </div>
          <div className="contact-card__text">
            <div className="label">Куратор от компании</div>
            <div className="value">{activeCompany.contactPerson}</div>
          </div>
        </div>
      </div>

      {/* Tech Stack Cloud */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0c1938', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code2 size={16} color="#3a75b4" /> Технологический стек и специализация:
        </h3>
        <div className="tech-cloud">
          {activeCompany.techStack.map((tech) => (
            <span key={tech} className="tech-pill">
              ● {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs Row (Schedule-style authorial container) */}
      <div className="uust-container">
        <div className="uust-tabs-row">
          <button
            className={`uust-tab ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => setActiveTab('cases')}
          >
            <Briefcase size={14} /> Кейсы для студентов ({companyCases.length})
          </button>
          <button
            className={`uust-tab ${activeTab === 'internships' ? 'active' : ''}`}
            onClick={() => setActiveTab('internships')}
          >
            <GraduationCap size={14} /> Программа стажировок
          </button>
          <button
            className={`uust-tab ${activeTab === 'mentors' ? 'active' : ''}`}
            onClick={() => setActiveTab('mentors')}
          >
            <Users size={14} /> Наставники и менторы
          </button>
        </div>

        <div className="uust-box">
          {activeTab === 'cases' && (
            <div>
              {companyCases.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  На данный момент у компании нет открытых кейсов.
                </div>
              ) : (
                <div className="case-grid">
                  {companyCases.map((c) => (
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

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {c.recommendedTech.slice(0, 4).map((tech) => (
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
                        </div>
                      </div>

                      <div className="case-card__footer-bar">
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Заявок: <strong>{c.applicationsCount}</strong>
                        </span>
                        <Link to={`/cases/${c.id}`} className="btn btn-primary btn-sm">
                          Подробнее →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'internships' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0c1938', margin: '0 0 10px' }}>
                Порядок прохождения производственной практики в {activeCompany.shortName}
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: '0 0 18px' }}>
                Студенты Института информатики, математики и робототехники (ИИМР), успешно решившие проектные кейсы компании, получают преимущественное право на зачисление на оплачиваемую стажировку с официальным оформлением и зачетом производственной практики.
              </p>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#1e4b85', fontSize: '13px', marginBottom: '6px' }}>1. Выбор и защита кейса</div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                    Решение технического задания компании в рамках семестрового курса проектного обучения.
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#1e4b85', fontSize: '13px', marginBottom: '6px' }}>2. Договор с кафедрой</div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                    Заключение индивидуального или группового договора о прохождении практики между и предприятием.
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#1e4b85', fontSize: '13px', marginBottom: '6px' }}>3. Оффер и трудоустройство</div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                    По итогам демо-дня лучшие студенты получают предложение о работе (Junior Developer / QA / Analyst).
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mentors' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0c1938', margin: '0 0 14px' }}>
                Наставники и эксперты от предприятия
              </h3>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                    alt=""
                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0c1938' }}>{activeCompany.contactPerson}</div>
                    <div style={{ fontSize: '12px', color: '#3a75b4', fontWeight: 600 }}>Ведущий архитектор R&D</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Экспертиза: SCADA, Python, Архитектура распределенных систем</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
                    alt=""
                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0c1938' }}>Ахметова Лилия Фаритовна</div>
                    <div style={{ fontSize: '12px', color: '#3a75b4', fontWeight: 600 }}>Team Lead AI & Data Engineering</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Экспертиза: Компьютерное зрение, PyTorch, MLOps, выпускница</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for creating a case from company */}
      <CreateCaseModal isOpen={createCaseModalOpen} onClose={() => setCreateCaseModalOpen(false)} />
    </div>
  )
}
