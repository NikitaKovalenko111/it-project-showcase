import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { updateApplicationStatusRequest } from '../store/actions'
import {
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
  const { applicationsList: allApplications } = useAppSelector((state) => state.applications)
  const { currentUser } = useAppSelector((state) => state.auth)

  const applicationsList = currentUser?.role === 'company'
    ? allApplications.filter((app) => app.companyId === currentUser.companyProfile?.companyId) : allApplications

  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredApps = applicationsList.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter
    const matchesSearch =
      app.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.studentInstitute.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const handleUpdateStatus = (appId: string, status: ApplicationStatus) => {
    dispatch(updateApplicationStatusRequest(appId, status))
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Входящие заявки студентов на кейсы</h1>
          <p>
            Рассмотрение резюме, мотивационных писем и отбор студентов УУНиТ в проектные команды вашего предприятия.
          </p>
        </div>
      </div>

      {/* UUST Schedule-style filter container */}
      <div className="uust-container">
        <div className="uust-tabs-row">
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
            🕒 На рассмотрении ({applicationsList.filter((a) => a.status === 'pending').length})
          </button>
          <button
            className={`uust-tab ${statusFilter === 'interview' ? 'active' : ''}`}
            onClick={() => setStatusFilter('interview')}
          >
            💬 Назначено интервью
          </button>
          <button
            className={`uust-tab ${statusFilter === 'accepted' ? 'active' : ''}`}
            onClick={() => setStatusFilter('accepted')}
          >
            ✅ Приняты в команду ({applicationsList.filter((a) => a.status === 'accepted').length})
          </button>
          <button
            className={`uust-tab ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            ❌ Отклонены
          </button>
        </div>

        <div className="uust-box">
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по ФИО студента, институту или названию кейса..."
              />
            </div>
          </div>
        </div>
      </div>

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
          {filteredApps.map((app) => (
            <div key={app.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <img
                    src={app.studentAvatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'}
                    alt=""
                    style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #dce4ed' }}
                  />
                  <div>
                    <h3 style={{ margin: '0 0 2px', fontSize: '16px', color: '#0c1938', fontWeight: 800 }}>
                      {app.studentName}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#627282', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span>{app.studentInstitute}</span>
                      <span>•</span>
                      <span>{app.studentCourse} курс</span>
                      <span>•</span>
                      <span>{app.applicantType === 'individual' ? 'Индивидуально' : `Команда ${app.teamName || ''}`}</span>
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
                    {app.status === 'accepted'
                      ? '✅ Принят в команду'
                      : app.status === 'rejected'
                      ? '❌ Заявка отклонена'
                      : app.status === 'interview'
                      ? '💬 Назначено собеседование'
                      : '🕒 На рассмотрении'}
                  </span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #eef2f6' }}>
                <div style={{ fontSize: '11px', color: '#627282', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Кейс предприятия:
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e4b85' }}>
                  <Link to={`/cases/${app.caseId}`}>{app.caseTitle}</Link>
                </div>

                <div style={{ marginTop: '10px', fontSize: '13px', color: '#334455', lineHeight: 1.5 }}>
                  <strong>Мотивационное письмо:</strong> {app.coverLetter}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#627282' }}>
                    <Mail size={13} /> {app.studentEmail}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#627282' }}>
                    <Phone size={13} /> {app.studentPhone}
                  </span>
                  {app.portfolioUrl && (
                    <a href={app.portfolioUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3a75b4', fontWeight: 700 }}>
                      <FileText size={13} /> Портфолио
                    </a>
                  )}
                  {app.githubUrl && (
                    <a href={app.githubUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3a75b4', fontWeight: 700 }}>
                      <ExternalLink size={13} /> GitHub
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {app.status !== 'accepted' && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleUpdateStatus(app.id, 'accepted')}
                    >
                      <CheckCircle2 size={13} /> Принять в команду
                    </button>
                  )}
                  {app.status !== 'interview' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUpdateStatus(app.id, 'interview')}
                    >
                      Назначить интервью
                    </button>
                  )}
                  {app.status !== 'rejected' && (
                    <button
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
        </div>
      )}
    </div>
  )
}
