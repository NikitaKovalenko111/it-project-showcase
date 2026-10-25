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
  const dispatch = useAppDispatch()

  const { activeCase, favorites, ndaAcceptedCases, loading, error } = useAppSelector((state) => state.cases)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const { currentUser } = useAppSelector((state) => state.auth)

  const [applicationModalOpen, setApplicationModalOpen] = useState(false)
  const [ndaModalOpen, setNdaModalOpen] = useState(false)
  const [ndaAcceptedLocal, setNdaAcceptedLocal] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseByIdRequest(id))
      dispatch(fetchApplicationsRequest(id))
    }
  }, [dispatch, id])

  if (error) return <div role="alert" className="card" style={{ padding: 24 }}>{error} <Link to="/cases">К списку кейсов</Link></div>

  if (loading || !activeCase || activeCase.id !== id) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>Загрузка кейса...</div>
  }

  const isFavorite = favorites.includes(activeCase.id)
  const isNDASigned =
    !activeCase.isConfidential ||
    ndaAcceptedCases.includes(activeCase.id) ||
    ndaAcceptedLocal ||
    currentUser?.role !== 'student'

  const userApplication = applicationsList.find(
    (app) => app.caseId === activeCase.id && app.studentId === currentUser?.id
  )

  const isCompanyRepresentative =
    currentUser?.role === 'company' &&
    currentUser?.companyProfile?.companyId === activeCase.companyId

  const isCuratorOrAdmin = currentUser?.role === 'admin'

  const canReviewApplications = isCompanyRepresentative || isCuratorOrAdmin

  const handleStatusChange = (appId: string, status: any) => {
    dispatch(updateApplicationStatusRequest(appId, status))
  }

  return (
    <div>
      {/* Back button & Action header */}
      <div className="page-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <Link to="/cases" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Вернуться к витрине кейсов
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentUser?.role === 'student' && <button
            className={`btn btn-secondary btn-sm ${isFavorite ? 'favorited' : ''}`}
            onClick={() => dispatch(toggleFavoriteRequest(activeCase.id))}
          >
            <Bookmark size={15} fill={isFavorite ? '#d94326' : 'none'} color={isFavorite ? '#d94326' : 'inherit'} />
            {isFavorite ? 'В избранном' : 'В избранное'}
          </button>}

          {activeCase.status === 'in_progress' || activeCase.status === 'submitted' || activeCase.status === 'completed' ? (
            <Link to={`/cases/${activeCase.id}/workspace`} className="btn btn-primary btn-sm">
              <Layers size={15} /> Рабочая страница проекта →
            </Link>
          ) : currentUser?.role === 'student' && isPublished(activeCase) ? (
            userApplication ? (
              <span className="badge badge-status status-open" style={{ padding: '8px 12px', fontSize: '12px' }}>
                <CheckCircle2 size={14} /> Вы подали заявку (Статус: {userApplication.status})
              </span>
            ) : (
              <button className="btn btn-primary" onClick={() => setApplicationModalOpen(true)}>
                <Send size={15} /> Подать заявку на кейс
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="case-detail-layout">
        {/* Left Column: Details & ТЗ */}
        <div>
          {/* Main Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <img
                  src={activeCase.companyLogo}
                  alt={activeCase.companyName}
                  style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1b5e91' }}>{activeCase.companyName}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                    {activeCase.isConfidential && (
                      <span className="badge badge-confidential">
                        <FileLock2 size={12} /> Конфиденциальный (NDA)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isPublished(activeCase) && <p className={`badge publication-${publicationStatus(activeCase)}`}>{publicationLabels[publicationStatus(activeCase)]}</p>}
              {activeCase.moderationComment && <p>{activeCase.moderationComment}</p>}
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f2b48', margin: '0 0 14px', lineHeight: 1.3 }}>
                {activeCase.title}
              </h1>

              <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, marginBottom: '20px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f2b48' }}>
                    Полное техническое задание (ТЗ)
                  </h3>
                  {activeCase.isConfidential && isNDASigned && (
                    <span style={{ fontSize: '11px', color: '#16805b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} /> NDA подписано
                    </span>
                  )}
                </div>

                {!isNDASigned ? (
                  <div
                    style={{
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <FileLock2 size={40} color="#e11d48" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ margin: '0 0 6px', color: '#9f1239' }}>
                      Доступ ограничен: требуется подписать соглашение о неразглашении (NDA)
                    </h4>
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#881337', maxWidth: '500px', marginInline: 'auto' }}>
                      Данный проект содержит алгоритмы и данные, составляющие коммерческую тайну компании. Ознакомьтесь и подпишите электронное NDA в один клик.
                    </p>
                    <button className="btn btn-primary" onClick={() => setNdaModalOpen(true)}>
                      <ShieldAlert size={16} /> Ознакомиться и подписать NDA
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '20px',
                      fontSize: '13px',
                      lineHeight: '1.7',
                      color: '#1e293b',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {activeCase.fullDescription}
                  </div>
                )}
              </div>

              {/* Requirements for the result & evaluation order */}
              <div className="responsive-grid" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px', color: '#0f2b48' }}>
                    <ClipboardList size={14} aria-hidden="true" /> Требования к результату:
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                    {activeCase.resultRequirements}
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px', color: '#0f2b48' }}>
                    <Scale size={14} aria-hidden="true" /> Порядок оценки:
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                    {activeCase.evaluationOrder}
                  </p>
                </div>
              </div>

              <details className="rights-info">
                <summary aria-label="Права на результаты" title="Права на результаты"><Info size={18} /></summary>
                <p><strong>Права на результаты:</strong> {activeCase.ipRights === 'non_exclusive_license'
                  ? 'Компания получает неисключительную лицензию, исключительные права сохраняются за авторами.'
                  : activeCase.ipRights === 'open_source' ? 'Проект публикуется под свободной лицензией.'
                  : activeCase.ipRights === 'author' ? 'Исключительные права сохраняются за автором.'
                  : 'Условия передачи исключительных прав определяются отдельным соглашением с компанией.'}</p>
              </details>
            </div>
          </div>

          {/* Incoming Applications Section (for Company, Curator, Admin) */}
          {canReviewApplications && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card__header">
                <h3 style={{ margin: 0, fontSize: '16px' }}>Поступившие заявки от студентов ({applicationsList.length})</h3>
                <span className="badge badge-direction">Модуль отбора</span>
              </div>
              <div className="card__body" style={{ padding: 0 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={app.studentAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <strong style={{ fontSize: '14px', color: '#1e293b' }}>{app.studentName}</strong>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {app.applicantType === 'team' ? `Команда: ${app.teamName}` : 'Индивидуальная заявка'} •{' '}
                              {app.studentCourse} курс ({app.studentInstitute})
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

                      <p style={{ margin: '4px 0', fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                        "{app.coverLetter}"
                      </p>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                        {app.githubUrl && (
                          <a href={app.githubUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#1b5e91', fontWeight: 600 }}>
                            <Github size={13} /> GitHub кандидата
                          </a>
                        )}
                        {app.portfolioUrl && (
                          <a href={app.portfolioUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#1b5e91', fontWeight: 600 }}>
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
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    Общий призовой фонд:
                  </span>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f2b48', margin: '4px 0 12px' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#0f2b48' }}>
                            <Trophy size={14} color="#d97706" /> {pp.place} место
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#16805b', marginTop: '2px' }}>
                            {pp.reward}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Критерий: {pp.criteria}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeCase.rewardType === 'monetary' && (
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    Денежное вознаграждение:
                  </span>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#16805b', margin: '4px 0 8px' }}>
                    {activeCase.rewardAmount?.toLocaleString('ru-RU')} ₽
                  </div>
                  <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                    {activeCase.rewardDescription}
                  </p>
                </div>
              )}

              {activeCase.rewardType === 'educational' && (
                <div>
                  <span className="badge badge-reward-educational" style={{ marginBottom: '8px' }}>
                    Образовательный проект
                  </span>
                  <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                    {activeCase.rewardDescription || 'Сертификат от компании, рекомендательное письмо и подтверждение в портфолио.'}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                Статус выплаты: <strong>{activeCase.paymentStatus === 'confirmed' ? 'Подтверждена компанией' : 'Ожидается приемка'}</strong>
              </div>
            </div>
          </div>

          {/* Quick Specifications */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '15px' }}>Параметры выполнения</h3>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="action-row"><span className="badge badge-direction">{activeCase.direction}</span><span className="badge badge-complexity-medium">Уровень: {activeCase.complexity.toLowerCase()}</span></div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Формат работы:</span>
                <strong style={{ fontSize: '13px', textTransform: 'capitalize' }}>{activeCase.workFormat}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Длительность:</span>
                <strong style={{ fontSize: '13px' }}>{activeCase.duration}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Крайний срок (Дедлайн):</span>
                <strong style={{ fontSize: '13px', color: '#b91c1c' }}>
                  {new Date(activeCase.deadlineDate).toLocaleDateString('ru-RU')}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Размер команды:</span>
                <strong style={{ fontSize: '13px' }}>
                  {activeCase.participationFormat === 'individual'
                    ? 'Индивидуально'
                    : `${activeCase.teamSize.min} - ${activeCase.teamSize.max} участников`}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Необходимые компетенции:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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

      {/* Modals */}
      <ApplicationModal
        caseItem={activeCase}
        isOpen={applicationModalOpen}
        onClose={() => setApplicationModalOpen(false)}
      />

      <NdaModal
        caseItem={activeCase}
        isOpen={ndaModalOpen}
        onClose={() => setNdaModalOpen(false)}
        onAccepted={() => setNdaAcceptedLocal(true)}
      />
    </div>
  )
}
