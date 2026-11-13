import { matchesSearch } from '../utils/publication'
import { IdentityImage } from '../components/IdentityImage'
import { formatDate } from '../utils/date'
import { apiRuntime } from '../api/runtime'
import { FileDownload } from '../components/FileDownload'
import { PaginatedGrid } from '../components/PaginatedGrid'
import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchApplicationsRequest, updateApplicationStatusRequest } from '../store/actions'
import {
  MessageSquare,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Mail,
  Phone,
  Search,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import type { ApplicationStatus } from '../types/models'

export const CompanyApplicationsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const [params] = useSearchParams()
  const caseFilter = params.get('caseId')
  useEffect(() => {
    dispatch(fetchApplicationsRequest())
  }, [dispatch])
  const {
    applicationsList: allApplications,
    loading,
    error,
  } = useAppSelector((state) => state.applications)
  const { currentUser } = useAppSelector((state) => state.auth)

  const projects = useAppSelector((s) => s.cases.casesList)
  const kindOf = (caseId: string) =>
    projects.find((project) => project.id === caseId)?.kind || 'case'
  const [taskKind, setTaskKind] = useState('all')
  const accessibleApplications = allApplications.filter(
    (app) =>
      (taskKind === 'all' || kindOf(app.caseId) === taskKind) &&
      (apiRuntime.mode !== 'mock' ||
        currentUser?.role !== 'company' ||
        app.companyId === currentUser.companyProfile?.companyId),
  )
  const applicationsList = caseFilter
    ? accessibleApplications.filter((app) => app.caseId === caseFilter)
    : accessibleApplications

  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredApps = applicationsList.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter
    return (
      matchesStatus &&
      matchesSearch(searchTerm, app.studentName, app.caseTitle, app.studentInstitute, app.teamName)
    )
  })

  const handleUpdateStatus = (appId: string, status: ApplicationStatus) => {
    dispatch(updateApplicationStatusRequest(appId, status))
  }

  return (
    <div className="company-applications-page">
      <div className="page-header">
        <div className="page-header__content">
          <h1>Входящие заявки и регистрации</h1>
          <p>Отбирайте исполнителей для кейсов и просматривайте регистрации на мероприятия.</p>
        </div>
      </div>

      {/* UUST Schedule-style filter container */}
      <div className="uust-container">
        <div className="uust-tabs-row application-status-tabs">
          <button
            className={`uust-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Все заявки ({applicationsList.length})
          </button>
          <button
            className={`uust-tab ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <Clock size={14} aria-hidden="true" /> На рассмотрении (
            {applicationsList.filter((a) => a.status === 'pending').length})
          </button>
          <button
            className={`uust-tab ${statusFilter === 'interview' ? 'active' : ''}`}
            onClick={() => setStatusFilter('interview')}
          >
            <MessageSquare size={14} aria-hidden="true" /> Назначено интервью
          </button>
          <button
            className={`uust-tab ${statusFilter === 'accepted' ? 'active' : ''}`}
            onClick={() => setStatusFilter('accepted')}
          >
            <CheckCircle2 size={14} aria-hidden="true" /> Принятые заявки / регистрации (
            {applicationsList.filter((a) => a.status === 'accepted').length})
          </button>
          <button
            className={`uust-tab ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            <XCircle size={14} aria-hidden="true" /> Отклонены
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Студент или название кейса"
              />
            </div>
            <label className="catalog-sort">
              Тип задания
              <select
                className="uust-select"
                value={taskKind}
                onChange={(event) => setTaskKind(event.target.value)}
              >
                <option value="all">Все форматы</option>
                <option value="case">Кейсы</option>
                <option value="hackathon">Хакатоны</option>
                <option value="olympiad">Олимпиады</option>
                {apiRuntime.mode !== 'live' && <option value="internship">Стажировки</option>}
              </select>
            </label>
          </div>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {filteredApps.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Users size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Заявок не найдено</h3>
          <p style={{ color: '#64748b', fontSize: '13px' }}>
            По выбранному фильтру заявок студентов нет.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {
            <PaginatedGrid className="paginated-stack" paginationKey="incomingApplications">
              {filteredApps.map((app) => (
                <div key={app.id} className="card application-card">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                      marginBottom: '14px',
                    }}
                  >
                    <div
                      className="candidate-identity"
                      style={{ display: 'flex', gap: '14px', alignItems: 'center' }}
                    >
                      <IdentityImage
                        src={app.studentAvatar}
                        name={app.studentName}
                        className="candidate-avatar"
                      />
                      <div>
                        <h3
                          style={{
                            margin: '0 0 2px',
                            fontSize: '16px',
                            color: '#0c1938',
                            fontWeight: 800,
                          }}
                        >
                          <Link
                            className="profile-link"
                            title="Открыть профиль студента"
                            to={`/profile/${app.studentId}`}
                          >
                            {app.studentName}
                          </Link>
                        </h3>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#627282',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          {[
                            app.studentInstitute,
                            app.studentGroup,
                            app.studentCourse > 0 ? `${app.studentCourse} курс` : '',
                            app.applicantType === 'individual'
                              ? 'Индивидуально'
                              : app.teamName || 'Команда',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`badge badge-status ${
                          app.status === 'accepted'
                            ? 'status-completed'
                            : app.status === 'rejected'
                              ? 'status-moderation'
                              : app.status === 'interview'
                                ? 'status-review'
                                : 'status-open'
                        }`}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        {app.status === 'accepted' ? (
                          <CheckCircle2 size={13} />
                        ) : app.status === 'rejected' ? (
                          <XCircle size={13} />
                        ) : app.status === 'interview' ? (
                          <MessageSquare size={13} />
                        ) : (
                          <Clock size={13} />
                        )}
                        {app.consentPending
                          ? 'Ожидаются согласия команды'
                          : app.status === 'withdrawn'
                            ? 'Заявка отозвана'
                            : app.status === 'accepted'
                              ? app.applicantType === 'team'
                                ? 'Команда принята'
                                : 'Заявка принята'
                              : app.status === 'rejected'
                                ? 'Заявка отклонена'
                                : app.status === 'interview'
                                  ? 'Назначено собеседование'
                                  : app.status === 'need_info'
                                    ? 'Запрошены уточнения'
                                    : 'На рассмотрении'}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '14px',
                      borderRadius: '8px',
                      marginBottom: '14px',
                      border: '1px solid #eef2f6',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#627282',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      Публикация:
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e4b85' }}>
                      <Link to={`/cases/${app.caseId}`}>{app.caseTitle}</Link>
                    </div>

                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '13px',
                        color: '#334455',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Мотивационное письмо:</strong> {app.coverLetter}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div className="application-contacts">
                      {app.studentEmail && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#627282',
                          }}
                        >
                          <Mail size={13} /> {app.studentEmail}
                        </span>
                      )}
                      {app.studentPhone && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#627282',
                          }}
                        >
                          <Phone size={13} /> {app.studentPhone}
                        </span>
                      )}
                      <small>Подано {formatDate(app.createdAt)}</small>
                      {app.resumeUrl && (
                        <FileDownload file={{ name: 'Резюме', url: app.resumeUrl }} />
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
                            color: '#3a75b4',
                            fontWeight: 700,
                          }}
                        >
                          <FileText size={13} /> Портфолио
                        </a>
                      )}
                      {app.githubUrl && (
                        <a
                          href={app.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#3a75b4',
                            fontWeight: 700,
                          }}
                        >
                          <ExternalLink size={13} /> GitHub
                        </a>
                      )}
                    </div>

                    <div className="action-row">
                      {!app.isRegistration &&
                        !app.consentPending &&
                        ['pending', 'interview'].includes(app.status) && (
                          <button
                            disabled={loading}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUpdateStatus(app.id, 'need_info')}
                          >
                            Запросить уточнения
                          </button>
                        )}
                      {app.status === 'accepted' && (
                        <Link
                          className="btn btn-primary btn-sm"
                          to={`/cases/${app.caseId}/workspace?application=${app.id}`}
                        >
                          К проекту команды
                        </Link>
                      )}
                      {!app.isRegistration &&
                        !app.consentPending &&
                        ['pending', 'interview'].includes(app.status) && (
                          <button
                            disabled={loading}
                            className="btn btn-success btn-sm"
                            onClick={() => handleUpdateStatus(app.id, 'accepted')}
                          >
                            <CheckCircle2 size={13} /> Принять в команду
                          </button>
                        )}
                      {!app.isRegistration &&
                        !app.consentPending &&
                        ['pending', 'need_info'].includes(app.status) && (
                          <button
                            disabled={loading}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUpdateStatus(app.id, 'interview')}
                          >
                            Назначить интервью
                          </button>
                        )}
                      {!app.isRegistration &&
                        !app.consentPending &&
                        ['pending', 'interview', 'need_info'].includes(app.status) && (
                          <button
                            disabled={loading}
                            className="btn btn-danger btn-sm"
                            onClick={() => handleUpdateStatus(app.id, 'rejected')}
                          >
                            <XCircle size={13} /> Отклонить
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </PaginatedGrid>
          }
        </div>
      )}
    </div>
  )
}
