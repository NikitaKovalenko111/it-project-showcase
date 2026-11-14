import { IdentityImage } from './IdentityImage'
import { formatDate } from '../utils/date'
import { FileDownload } from './FileDownload'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { CaseApplication } from '../types/models'
import { useAppDispatch } from '../store'
import { PaginatedGrid } from './PaginatedGrid'
import { fetchApplicationsRequest, fetchCaseByIdRequest, fetchTeamsRequest } from '../store/actions'

const labels = {
  pending: 'На рассмотрении',
  interview: 'Интервью',
  need_info: 'Нужны уточнения',
  accepted: 'Принят',
  rejected: 'Отклонен',
  withdrawn: 'Отозвана',
}
export const CaseApplications: React.FC<{ caseId: string; registrations?: boolean }> = ({
  caseId,
  registrations = false,
}) => {
  const dispatch = useAppDispatch()
  const [applications, setApplications] = useState<CaseApplication[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    apiClient
      .getApplications(caseId)
      .then((items) => {
        if (active) setApplications(items)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [caseId])
  const visible = applications.filter((a) => !!a.isRegistration === registrations)
  const decide = async (id: string, status: CaseApplication['status']) => {
    setBusy(true)
    setError('')
    try {
      await apiClient.updateApplicationStatus(id, status)
      setApplications(await apiClient.getApplications(caseId))
      dispatch(fetchApplicationsRequest(caseId))
      dispatch(fetchTeamsRequest())
      dispatch(fetchCaseByIdRequest(caseId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card feature-panel">
      <h2>
        {registrations ? 'Регистрации на мероприятие' : 'Заявки студентов на кейс'}{' '}
        {!loading && !error && `(${visible.length})`}
      </h2>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Загрузка заявок…</p>}
      {!loading && !error && !visible.length && (
        <p>{registrations ? 'Регистраций пока нет.' : 'Заявок пока нет.'}</p>
      )}
      <PaginatedGrid className="paginated-stack" paginationKey="workspaceApplications">
        {!loading &&
          visible.map((a) => (
            <article key={a.id} className="feature-row application-card">
              <header className="application-card__header">
                <div className="candidate-identity">
                  <IdentityImage
                    src={a.studentAvatar}
                    name={a.studentName}
                    className="candidate-avatar"
                  />
                  <div>
                    <Link className="profile-link" to={`/profile/${a.studentId}`}>
                      {a.studentName}
                    </Link>
                    <small>
                      {[
                        a.teamName || 'Индивидуально',
                        a.studentGroup,
                        a.studentCourse > 0 ? `${a.studentCourse} курс` : '',
                        formatDate(a.createdAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </div>
                </div>
                <span
                  className={`badge ${a.status === 'accepted' ? 'status-completed' : 'badge-direction'}`}
                >
                  {a.consentPending
                    ? 'Ожидаются согласия команды'
                    : registrations && a.status === 'accepted'
                      ? 'Участие подтверждено'
                      : labels[a.status]}
                </span>
              </header>
              {a.coverLetter && (
                <p className="application-card__letter">
                  <strong>Мотивационное письмо</strong>
                  {a.coverLetter}
                </p>
              )}
              {(a.resumeUrl || a.portfolioUrl || a.githubUrl || a.status === 'accepted') && (
                <div className="action-row">
                  {a.resumeUrl && <FileDownload file={{ name: 'Резюме', url: a.resumeUrl }} />}
                  {a.portfolioUrl && (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={a.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Портфолио
                    </a>
                  )}
                  {a.githubUrl && (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={a.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Репозиторий
                    </a>
                  )}
                  {a.status === 'accepted' && (
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={`/cases/${a.caseId}/workspace?application=${a.id}`}
                    >
                      Открыть работу
                    </Link>
                  )}
                </div>
              )}
              {!registrations &&
                !a.consentPending &&
                !['accepted', 'rejected', 'withdrawn'].includes(a.status) && (
                  <div className="action-row">
                    {(['interview', 'need_info', 'accepted', 'rejected'] as const).map(
                      (status) =>
                        status !== a.status &&
                        !(status === 'accepted' && a.status === 'need_info') && (
                          <button
                            key={status}
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => decide(a.id, status)}
                          >
                            {
                              {
                                interview: 'Назначить интервью',
                                need_info: 'Запросить уточнения',
                                accepted: 'Принять',
                                rejected: 'Отклонить',
                              }[status]
                            }
                          </button>
                        ),
                    )}
                  </div>
                )}
            </article>
          ))}
      </PaginatedGrid>
    </section>
  )
}
