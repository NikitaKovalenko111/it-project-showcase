import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRuntime } from '../api/runtime'
import { communityApi } from '../api/community'
import { apiClient } from '../api/client'
import { CaseProject, Company, SystemNotification } from '../types/models'
import { useAppSelector } from '../store'

export const InvitationPage: React.FC = () => {
  const { id } = useParams(),
    user = useAppSelector((s) => s.auth.currentUser)
  const [notification, setNotification] = useState<SystemNotification>(),
    [project, setProject] = useState<CaseProject>(),
    [company, setCompany] = useState<Company>(),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    setNotification(undefined)
    setError('')
    communityApi
      .getInvitation(id!)
      .then(async (n) => {
        setNotification(n)
        const inv = n.invitation!
        if (inv.caseId) setProject(await apiClient.getCaseById(inv.caseId).catch(() => undefined))
        if (inv.companyId) setCompany(await apiClient.getCompanyById(inv.companyId))
      })
      .catch((e) => setError(e.message))
  }, [id, user?.id])
  const respond = async (status?: 'accepted' | 'rejected') => {
    setBusy(true)
    setError('')
    try {
      setNotification(
        await communityApi.respondInvitation(id!, status, status ? undefined : message),
      )
      setMessage('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const invitation = notification?.invitation
  return (
    <div>
      <Link className="btn btn-secondary" to="/">
        На главную
      </Link>
      <section className="card feature-panel">
        <h1>Приглашение</h1>
        {error && <p role="alert">{error}</p>}
        {!notification && !error && <p role="status">Загрузка…</p>}
        {invitation && (
          <>
            <h2>{notification.title}</h2>
            <p>Отправитель: {invitation.senderName}</p>
            <p>Причина: {invitation.reason}</p>
            <p>{notification.message}</p>
            {project && <Link to={`/cases/${project.id}`}>Кейс: {project.title}</Link>}
            {!project && invitation.teamId && <p>Приглашение в команду без привязки к кейсу.</p>}
            {company && (
              <div className="feature-row">
                <Link to={`/company/${company.id}`}>{company.name}</Link>
                <p>{company.description}</p>
                <span>
                  {company.email} · {company.phone}
                </span>
              </div>
            )}
            <p>
              Статус:{' '}
              {
                { pending: 'Ожидает ответа', accepted: 'Принято', rejected: 'Отклонено' }[
                  invitation.status
                ]
              }
            </p>
            {invitation.status === 'pending' && notification.userId === user?.id && (
              <div className="action-row">
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => respond('accepted')}
                >
                  Принять
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => respond('rejected')}
                >
                  Отклонить
                </button>
              </div>
            )}
            {invitation.status === 'accepted' && invitation.caseId && !invitation.teamId && (
              <Link className="btn btn-primary" to={`/cases/${invitation.caseId}`}>
                Перейти к кейсу и подать заявку
              </Link>
            )}
            {apiRuntime.mode === 'mock' && (
              <>
                <h3>Переписка</h3>
                {invitation.replies.map((r, i) => (
                  <div className="feature-row" key={i}>
                    <strong>{r.authorName}</strong>
                    <span>{new Date(r.createdAt).toLocaleString('ru-RU')}</span>
                    <p>{r.message}</p>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    respond()
                  }}
                >
                  <label>
                    Ответ отправителю
                    <textarea
                      className="textarea"
                      value={message}
                      maxLength={2000}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </label>
                  <button className="btn btn-primary" disabled={busy || !message.trim()}>
                    Ответить
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
