import { apiClient } from '../api/client'
import { complexityBadge } from '../utils/publication'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import { IdentityImage } from '../components/IdentityImage'
import { EventPlanPanel } from '../components/EventPlanPanel'
import { axiosInstance } from '../api/http'
import { apiRuntime } from '../api/runtime'
import { formatDate } from '../utils/date'
import { AdminCaseActions } from '../components/AdminCaseActions'
import { PublicationContext } from '../components/PublicationContext'
import { canReceiveApplications } from '../utils/recruiting'
import { CaseComments } from '../components/CaseComments'
import { FileDownload } from '../components/FileDownload'
import { TeamsPanel } from '../components/TeamsPanel'
import { ReportButton } from '../components/ReportButton'
import { CreateCaseModal } from '../components/modals/CreateCaseModal'
import { publicationLabels, publicationStatus, isPublished } from '../utils/publication'
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import {
  fetchApplicationsRequest,
  fetchCaseByIdRequest,
  toggleFavoriteRequest,
  updateApplicationStatusRequest,
} from '../store/actions'
import { canManageCase } from '../utils/access'
import { ApplicationModal } from '../components/modals/ApplicationModal'
import { NdaModal } from '../components/modals/NdaModal'
import {
  ClipboardList,
  Scale,
  Info,
  ArrowLeft,
  Award,
  Bookmark,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileLock2,
  FileText,
  FolderGit2,
  Github,
  Globe,
  Layers,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  User,
  Users,
  XCircle,
} from 'lucide-react'

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const companies = useAppSelector((state) => state.companies.companiesList)
  const viewerId = useAppSelector((state) => state.auth.currentUser?.id)
  useEffect(() => {
    if (apiRuntime.mode === 'live' && id && viewerId)
      void axiosInstance.put(`/cases/${id}/view`).catch(() => undefined)
  }, [id, viewerId])
  const dispatch = useAppDispatch()

  const { activeCase, favorites, ndaAcceptedCases, error } = useAppSelector((state) => state.cases)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [applicationModalOpen, setApplicationModalOpen] = useState(false)
  const [applicationNotice, setApplicationNotice] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [detailTab, setDetailTab] = useState('comments')
  const [ndaModalOpen, setNdaModalOpen] = useState(false)
  const [ndaAcceptedLocal, setNdaAcceptedLocal] = useState(false)

  useEffect(() => {
    setApplicationModalOpen(false)
    setApplicationNotice('')
    setNdaAcceptedLocal(false)
    setNdaModalOpen(false)
    if (id) {
      dispatch(fetchCaseByIdRequest(id))
      if (viewerId) dispatch(fetchApplicationsRequest())
    }
  }, [dispatch, id, viewerId])

  if (error && activeCase?.id !== id)
    return (
      <section role="alert" className="card empty-state detail-empty">
        <h1>{error}</h1>
        <Link
          className="btn btn-secondary"
          to={
            sessionStorage.getItem('cases-return-url')?.startsWith('/cases?')
              ? sessionStorage.getItem('cases-return-url')!
              : '/cases'
          }
        >
          К списку кейсов
        </Link>
      </section>
    )

  if (!activeCase || activeCase.id !== id) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
        Загрузка кейса...
      </div>
    )
  }

  const isFavorite = favorites.includes(activeCase.id)
  const isNDASigned =
    !activeCase.isConfidential ||
    ndaAcceptedCases.includes(activeCase.id) ||
    ndaAcceptedLocal ||
    currentUser?.role !== 'student'

  const userApplications =
    currentUser?.role === 'student'
      ? applicationsList.filter(
          (app) =>
            app.caseId === activeCase.id &&
            !['rejected', 'withdrawn'].includes(app.status) &&
            (app.studentId === currentUser.id || (apiRuntime.mode === 'live' && app.teamId)),
        )
      : []
  const userApplication =
    userApplications.find((app) => app.status === 'accepted') || userApplications[0]

  const isCompanyRepresentative =
    currentUser?.role === 'company' && canManageCase(currentUser, activeCase)

  const isCuratorOrAdmin = currentUser?.role === 'admin'
  const reviewing =
    apiRuntime.mode === 'live' &&
    activeCase.status === 'moderation' &&
    ['admin', 'curator', 'university'].includes(currentUser?.role || '')
  const reviewFiles = `${apiRuntime.baseUrl || '/api/v1'}/cases/${activeCase.id}/review/files`

  const instantRegistration = ['olympiad', 'hackathon'].includes(activeCase.kind || '')
  const canReviewApplications =
    (isCompanyRepresentative || isCuratorOrAdmin) && !instantRegistration

  const handleStatusChange = (appId: string, status: any) => {
    dispatch(updateApplicationStatusRequest(appId, status))
  }

  return (
    <div>
      {/* Back button & Action header */}
      <div
        className="page-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <Link
          to={
            sessionStorage.getItem('cases-return-url')?.startsWith('/cases?')
              ? sessionStorage.getItem('cases-return-url')!
              : '/cases'
          }
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={15} /> Вернуться к витрине кейсов
        </Link>

        <div className="page-actions">
          <AdminCaseActions project={activeCase} />
          {isCompanyRepresentative && activeCase.status === 'moderation' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await apiClient.withdrawCaseModeration(activeCase.id)
                  dispatch(fetchCaseByIdRequest(activeCase.id))
                  setApplicationNotice('Публикация отозвана для редактирования.')
                } catch (cause) {
                  setApplicationNotice((cause as Error).message)
                }
              }}
            >
              Отозвать с модерации
            </button>
          )}
          {canManageCase(currentUser, activeCase) && (
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)}>
              Редактировать кейс
            </button>
          )}
          {!isCompanyRepresentative && <ReportButton targetType="case" targetId={activeCase.id} />}
          {currentUser?.role === 'student' && (
            <button
              className={`btn btn-secondary btn-sm ${isFavorite ? 'favorited' : ''}`}
              style={{ height: 36, width: 36, padding: 0, flex: '0 0 36px' }}
              aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
              aria-pressed={isFavorite}
              onClick={() => dispatch(toggleFavoriteRequest(activeCase.id))}
            >
              <Bookmark
                size={18}
                fill={isFavorite ? '#d94326' : 'none'}
                color={isFavorite ? '#d94326' : '#64748b'}
              />
            </button>
          )}

          {canManageCase(currentUser, activeCase) ||
          userApplication?.status === 'accepted' ||
          (apiRuntime.mode === 'mock' &&
            ['in_progress', 'submitted', 'completed'].includes(activeCase.status)) ? (
            <Link to={`/cases/${activeCase.id}/workspace`} className="btn btn-primary btn-sm">
              <Layers size={15} /> Участники и решения →
            </Link>
          ) : currentUser?.role === 'student' && isPublished(activeCase) ? (
            userApplication ? (
              <span
                className="badge badge-status status-open"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                <CheckCircle2 size={14} />{' '}
                {userApplication.consentPending ? (
                  <Link to="/favorites?tab=applications">
                    {userApplication.canConsent
                      ? 'Подтвердить участие'
                      : 'Ожидаются согласия команды'}
                  </Link>
                ) : instantRegistration ? (
                  'Регистрация отправлена'
                ) : (
                  `Заявка: ${{ pending: 'На рассмотрении', accepted: 'Принята', rejected: 'Отклонена', withdrawn: 'Отозвана', interview: 'Назначено интервью', need_info: 'Нужны уточнения' }[userApplication.status]}`
                )}
              </span>
            ) : canReceiveApplications(activeCase) ? (
              <button className="btn btn-primary" onClick={() => setApplicationModalOpen(true)}>
                <Send size={15} /> {instantRegistration ? 'Зарегистрироваться' : 'Подать заявку'}
              </button>
            ) : (
              <span className="badge badge-status">Приём заявок закрыт</span>
            )
          ) : null}
        </div>
      </div>

      {activeCase.coverUrl && isPublished(activeCase) && (
        <img
          src={activeCase.coverUrl}
          alt="Обложка кейса"
          style={{
            width: '100%',
            maxHeight: 280,
            objectFit: 'cover',
            borderRadius: 12,
            marginBottom: 20,
          }}
        />
      )}
      {applicationNotice && (
        <p className="form-hint" role="status">
          {applicationNotice}
        </p>
      )}
      {/* Main Content Layout */}
      <div className="case-detail-layout">
        {/* Left Column: Details & ТЗ */}
        <div>
          {/* Main Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card__body">
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}
              >
                <IdentityImage
                  src={
                    activeCase.companyLogo ||
                    companies.find((company) => company.id === activeCase.companyId)?.logo
                  }
                  name={activeCase.companyName}
                  className="case-company-logo"
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1b5e91' }}>
                    {activeCase.companyName}
                  </div>
                  <div
                    style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}
                  >
                    {activeCase.isConfidential && (
                      <span className="badge badge-confidential">
                        <FileLock2 size={12} /> Конфиденциальный (NDA)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isPublished(activeCase) && (
                <p className={`badge publication-${publicationStatus(activeCase)}`}>
                  {publicationLabels[publicationStatus(activeCase)]}
                </p>
              )}
              {activeCase.moderationComment && <p>{activeCase.moderationComment}</p>}
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#0f2b48',
                  margin: '0 0 14px',
                  lineHeight: 1.3,
                }}
              >
                {activeCase.title}
              </h1>

              <p
                style={{
                  fontSize: '14px',
                  color: '#334155',
                  lineHeight: 1.6,
                  marginBottom: '20px',
                }}
              >
                {activeCase.shortDescription}
              </p>

              {/* Full Technical Specification Section */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '20px',
                  marginTop: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                  }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f2b48' }}>
                    Полное техническое задание (ТЗ)
                  </h3>
                  {activeCase.isConfidential && isNDASigned && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#16805b',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ShieldCheck size={14} /> NDA подписано
                    </span>
                  )}
                </div>

                {!isNDASigned ? (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fcd34d',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <FileLock2 size={40} color="#e11d48" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ margin: '0 0 6px', color: '#9f1239' }}>
                      Доступ ограничен: требуется подписать соглашение о неразглашении (NDA)
                    </h4>
                    <p
                      style={{
                        margin: '0 0 16px',
                        fontSize: '12px',
                        color: '#881337',
                        maxWidth: '500px',
                        marginInline: 'auto',
                      }}
                    >
                      Данный проект содержит алгоритмы и данные, составляющие коммерческую тайну
                      компании. Ознакомьтесь и подпишите электронное NDA в один клик.
                    </p>
                    <button className="btn btn-primary" onClick={() => setNdaModalOpen(true)}>
                      <ShieldAlert size={16} /> Ознакомиться и подписать NDA
                    </button>
                  </div>
                ) : (
                  <div
                    data-color-mode="light"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '20px',
                      fontSize: '13px',
                      lineHeight: '1.7',
                      color: '#1e293b',
                    }}
                  >
                    <MDEditor.Markdown
                      source={activeCase.fullDescription}
                      rehypePlugins={[rehypeSanitize]}
                    />
                  </div>
                )}
              </div>

              {/* Requirements for the result & evaluation order */}
              <div
                className="responsive-grid"
                style={{
                  marginTop: '24px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      margin: '0 0 8px',
                      color: '#0f2b48',
                    }}
                  >
                    <ClipboardList size={14} aria-hidden="true" /> Требования к результату:
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                    {activeCase.resultRequirements}
                  </p>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      margin: '0 0 8px',
                      color: '#0f2b48',
                    }}
                  >
                    <Scale size={14} aria-hidden="true" /> Порядок оценки:
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                    {activeCase.evaluationOrder}
                  </p>
                </div>
              </div>

              <details className="rights-info">
                <summary aria-label="Права на результаты" title="Права на результаты">
                  <Info size={17} aria-hidden="true" /> <span>Права на результаты</span>
                </summary>
                <p>
                  <strong>Права на результаты:</strong>{' '}
                  {activeCase.ipRights === 'non_exclusive_license'
                    ? 'Компания получает неисключительную лицензию, исключительные права сохраняются за авторами.'
                    : activeCase.ipRights === 'open_source'
                      ? 'Проект публикуется под свободной лицензией.'
                      : activeCase.ipRights === 'author'
                        ? 'Исключительные права сохраняются за автором.'
                        : 'Условия передачи исключительных прав определяются отдельным соглашением с компанией.'}
                </p>
              </details>
            </div>
          </div>

          {/* Incoming Applications Section (for Company, Curator, Admin) */}
          {canReviewApplications && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card__header">
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Поступившие заявки от студентов ({applicationsList.length})
                </h3>
                <span className="badge badge-direction">Модуль отбора</span>
              </div>
              <div
                className="card__body case-incoming-list"
                tabIndex={0}
                aria-label="Поступившие заявки студентов"
                style={{ padding: 0 }}
              >
                {applicationsList.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    Заявок на данный кейс пока не поступало
                  </div>
                ) : (
                  applicationsList.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        padding: '18px 20px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div
                        className="case-candidate-heading"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IdentityImage
                            src={app.studentAvatar}
                            name={app.studentName}
                            className="candidate-avatar"
                          />
                          <div>
                            <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                              {app.studentName}
                            </strong>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {app.applicantType === 'team'
                                ? `Команда: ${app.teamName}`
                                : 'Индивидуальная заявка'}{' '}
                              • {app.studentCourse} курс ({app.studentInstitute})
                            </div>
                          </div>
                        </div>

                        <span
                          className={`badge badge-status ${
                            app.status === 'accepted'
                              ? 'status-completed'
                              : app.status === 'interview'
                                ? 'status-open'
                                : 'status-moderation'
                          }`}
                        >
                          {app.status === 'accepted'
                            ? '✓ Принята'
                            : app.status === 'interview'
                              ? 'Собеседование'
                              : app.status === 'rejected'
                                ? 'Отклонена'
                                : 'На рассмотрении'}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: '4px 0',
                          fontSize: '12px',
                          color: '#334155',
                          background: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: '6px',
                        }}
                      >
                        "{app.coverLetter}"
                      </p>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                        {app.githubUrl && (
                          <a
                            href={app.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#1b5e91',
                              fontWeight: 600,
                            }}
                          >
                            <Github size={13} /> GitHub кандидата
                          </a>
                        )}
                        {app.portfolioUrl && (
                          <a
                            href={app.portfolioUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#1b5e91',
                              fontWeight: 600,
                            }}
                          >
                            <Globe size={13} /> Портфолио
                          </a>
                        )}
                      </div>

                      {/* Action buttons for company/curator */}
                      {app.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleStatusChange(app.id, 'accepted')}
                          >
                            <CheckCircle2 size={14} /> Принять заявку
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStatusChange(app.id, 'interview')}
                          >
                            <Users size={14} /> Назначить собеседование
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleStatusChange(app.id, 'rejected')}
                          >
                            <XCircle size={14} /> Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Key Meta, Rewards, Contest Places */}
        <div>
          {/* Rewards & Prizes Card */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Вознаграждение и фонд</h3>
              <Award size={18} color="#d97706" />
            </div>
            <div className="card__body">
              {activeCase.rewardType === 'contest' && (
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    Общий призовой фонд:
                  </span>
                  <div
                    style={{
                      fontSize: '26px',
                      fontWeight: 800,
                      color: '#0f2b48',
                      margin: '4px 0 12px',
                    }}
                  >
                    {activeCase.prizeFund?.toLocaleString('ru-RU')} ₽
                  </div>

                  {activeCase.prizePlaces && activeCase.prizePlaces.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {activeCase.prizePlaces.map((pp) => (
                        <div
                          key={pp.place}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '10px 12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#0f2b48',
                            }}
                          >
                            <Trophy size={14} color="#d97706" /> {pp.place} место
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#16805b',
                              marginTop: '2px',
                            }}
                          >
                            {pp.reward}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Критерий:{' '}
                            {pp.criteria.length > 120 ? (
                              <details>
                                <summary>{pp.criteria.slice(0, 120)}… Подробнее</summary>
                                {pp.criteria}
                              </details>
                            ) : (
                              pp.criteria
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeCase.rewardType === 'monetary' && (
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    Денежное вознаграждение:
                  </span>
                  <div
                    style={{
                      fontSize: '26px',
                      fontWeight: 800,
                      color: '#16805b',
                      margin: '4px 0 8px',
                    }}
                  >
                    {activeCase.rewardAmount?.toLocaleString('ru-RU')} ₽
                  </div>
                  <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                    {activeCase.rewardDescription}
                  </p>
                </div>
              )}

              {!['monetary', 'contest', 'educational'].includes(activeCase.rewardType) && (
                <p>
                  {activeCase.rewardDescription ||
                    'Вознаграждение и условия участия уточняются у компании.'}
                </p>
              )}
              {activeCase.rewardType === 'educational' && (
                <div>
                  <span className="badge badge-reward-educational" style={{ marginBottom: '8px' }}>
                    Образовательный проект
                  </span>
                  <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                    {activeCase.rewardDescription ||
                      'Сертификат от компании, рекомендательное письмо и подтверждение в портфолио.'}
                  </p>
                </div>
              )}

              {['monetary', 'contest'].includes(activeCase.rewardType) && (
                <div
                  style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '11px',
                    color: '#64748b',
                  }}
                >
                  Статус выплаты:{' '}
                  <strong>
                    {activeCase.paymentStatus === 'confirmed'
                      ? 'Подтверждена компанией'
                      : 'Ожидается приемка'}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Quick Specifications */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Параметры выполнения</h3>
            </div>
            <div
              className="card__body"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {activeCase.specificationFile &&
                (reviewing && activeCase.specificationFile.file_id ? (
                  <FileDownload
                    file={{
                      name: `Техническое задание · ${activeCase.specificationFile.name}`,
                      url: `${reviewFiles}/${activeCase.specificationFile.file_id}`,
                    }}
                  />
                ) : (
                  <a
                    className="btn btn-secondary"
                    href={activeCase.specificationFile.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Техническое задание: {activeCase.specificationFile.name}
                  </a>
                ))}
              {reviewing && activeCase.coverFileId && (
                <FileDownload
                  file={{ name: 'Обложка кейса', url: `${reviewFiles}/${activeCase.coverFileId}` }}
                />
              )}
              <div className="case-specification-row">
                <span>Тип мероприятия</span>
                <strong>
                  {
                    {
                      case: 'Кейс',
                      hackathon: 'Хакатон',
                      olympiad: 'Олимпиада',
                      internship: 'Стажировка',
                    }[activeCase.kind || 'case']
                  }
                </strong>
              </div>
              <div className="case-specification-row">
                <span>
                  {activeCase.participationFormat === 'team'
                    ? 'Максимум команд'
                    : activeCase.participationFormat === 'both'
                      ? 'Лимит заявок'
                      : 'Максимум участников'}
                </span>
                <strong>{activeCase.maxTeams || 'Без ограничений'}</strong>
              </div>
              <div className="case-specification-row">
                <span>Направление и уровень</span>
                <div className="action-row">
                  {activeCase.direction && (
                    <span className="badge badge-direction">{activeCase.direction}</span>
                  )}
                  <span className={`badge ${complexityBadge(activeCase.complexity)}`}>
                    {activeCase.complexity}
                  </span>
                </div>
              </div>
              {activeCase.olympiadRules && (
                <div className="case-specification-row">
                  <span>Регламент</span>
                  <strong>{activeCase.olympiadRules}</strong>
                </div>
              )}
              {activeCase.internshipConditions && (
                <div className="case-specification-row">
                  <span>Условия стажировки</span>
                  <strong>{activeCase.internshipConditions}</strong>
                </div>
              )}
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  Формат работы:
                </span>
                <strong style={{ fontSize: '13px', textTransform: 'capitalize' }}>
                  {activeCase.workFormat}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  Длительность:
                </span>
                <strong style={{ fontSize: '13px' }}>{activeCase.duration || 'Не указана'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  Крайний срок (Дедлайн):
                </span>
                <strong style={{ fontSize: '13px', color: '#b45309' }}>
                  {formatDate(activeCase.deadlineDate)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  Размер команды:
                </span>
                <strong style={{ fontSize: '13px' }}>
                  {activeCase.participationFormat === 'individual'
                    ? 'Индивидуально'
                    : `${activeCase.teamSize.min === activeCase.teamSize.max ? activeCase.teamSize.min : `${activeCase.teamSize.min}–${activeCase.teamSize.max}`} чел.`}
                </strong>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Необходимые компетенции:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {!activeCase.requiredCompetencies.length && <span>Не указаны</span>}
                  {activeCase.requiredCompetencies.map((comp) => (
                    <span
                      key={comp}
                      style={{
                        background: '#f1f5f9',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#334155',
                      }}
                    >
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {apiRuntime.mode === 'mock' &&
        currentUser?.role === 'student' &&
        isPublished(activeCase) &&
        canReceiveApplications(activeCase) &&
        activeCase.status === 'in_progress' &&
        !userApplication && (
          <button className="btn btn-primary" onClick={() => setApplicationModalOpen(true)}>
            Подать заявку своей команды
          </button>
        )}

      <PublicationContext project={activeCase} />
      {apiRuntime.mode === 'live' && instantRegistration && isPublished(activeCase) && (
        <EventPlanPanel key={activeCase.id} project={activeCase} />
      )}
      {!reviewing && <CaseComments caseId={activeCase.id} />}
      {!reviewing &&
        currentUser?.role !== 'student' &&
        !['olympiad', 'hackathon'].includes(activeCase.kind || '') && (
          <TeamsPanel caseId={activeCase.id} />
        )}

      <CreateCaseModal
        caseItem={activeCase}
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false)
          dispatch(fetchCaseByIdRequest(activeCase.id))
        }}
      />
      {/* Modals */}
      {applicationModalOpen && (
        <ApplicationModal
          key={activeCase.id}
          caseItem={activeCase}
          isOpen
          onClose={() => setApplicationModalOpen(false)}
          onSubmitted={(message) => {
            setApplicationNotice(message)
            setApplicationModalOpen(false)
          }}
        />
      )}

      <NdaModal
        caseItem={activeCase}
        isOpen={ndaModalOpen}
        onClose={() => setNdaModalOpen(false)}
        onAccepted={() => setNdaAcceptedLocal(true)}
      />
    </div>
  )
}
