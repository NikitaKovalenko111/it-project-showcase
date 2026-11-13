import { auditActionLabels, auditObjectLabels } from '../utils/adminLabels'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { communityApi } from '../api/community'
import type { ContentReport, User, AuditLog } from '../types/models'
import { ReportTableView } from './ReportTableView'
import { CatalogSearch } from './CatalogSearch'
import { matchesSearch } from '../utils/publication'

const targets = {
  case: ['Кейс', '/cases'],
  project: ['Студенческий проект', '/student-projects'],
  comment: ['Комментарий', ''],
  user: ['Профиль', '/profile'],
  company: ['Компания', '/company'],
}
const reasons: Record<string, string> = {
  spam: 'Спам',
  abuse: 'Оскорбления',
  fraud: 'Недостоверная информация',
  copyright: 'Нарушение авторских прав',
  other: 'Другое',
}
const roles = {
  student: 'Студенты',
  company: 'Компании',
  curator: 'Кураторы',
  university: 'Сотрудники',
  admin: 'Администраторы',
}

export function AdminInsights({
  reportsOnly = false,
  auditLogs,
}: {
  reportsOnly?: boolean
  auditLogs?: AuditLog[]
}) {
  const [users, setUsers] = useState<User[]>([])
  const [reports, setReports] = useState<ContentReport[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [status, setStatus] = useState('all')
  const [target, setTarget] = useState('all')
  const [reason, setReason] = useState('all')
  const [search, setSearch] = useState('')
  useEffect(() => {
    let active = true
    Promise.allSettled([
      reportsOnly ? Promise.resolve([]) : apiClient.getUsers(),
      communityApi.getReports(),
      reportsOnly || auditLogs ? Promise.resolve([]) : apiClient.getAuditLogs(),
    ]).then(([accounts, complaints, actions]) => {
      if (!active) return
      if (accounts.status === 'fulfilled') setUsers(accounts.value)
      if (complaints.status === 'fulfilled') setReports(complaints.value)
      if (actions.status === 'fulfilled') setLogs(actions.value)
      if ([accounts, complaints, actions].some((result) => result.status === 'rejected'))
        setError('Часть данных администрирования не загрузилась.')
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [reportsOnly, auditLogs !== undefined])
  const pending = reports.filter((report) => report.status === 'pending').length
  const visible = reports
    .filter(
      (report) =>
        (status === 'all' || report.status === status) &&
        (target === 'all' || report.targetType === target) &&
        (reason === 'all' || report.reason === reason) &&
        matchesSearch(
          search,
          report.message,
          report.id,
          report.targetId,
          reasons[report.reason],
          targets[report.targetType]?.[0],
        ),
    )
    .sort(
      (a, b) =>
        Number(b.status === 'pending') - Number(a.status === 'pending') ||
        b.createdAt.localeCompare(a.createdAt),
    )
  const resolve = async (id: string) => {
    setWorking(id)
    setError('')
    try {
      await communityApi.resolveReport(id)
      setReports((items) =>
        items.map((item) => (item.id === id ? { ...item, status: 'resolved' } : item)),
      )
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setWorking('')
    }
  }
  const rows = visible.map((report) => {
    const [name, path] = targets[report.targetType] || ['Материал', '']
    return {
      id: report.id,
      cells: [
        <time dateTime={report.createdAt}>
          {new Date(report.createdAt).toLocaleDateString('ru-RU')}
        </time>,
        <>
          {path ? <Link to={`${path}/${report.targetId}`}>{name}</Link> : name}
          <details className="report-details">
            <summary>Подробности</summary>
            <p className="preserve-text">{report.message || 'Пояснений нет.'}</p>
            <small>Идентификатор материала: {report.targetId}</small>
          </details>
        </>,
        reasons[report.reason] || report.reason,
        <span className={`report-status report-status--${report.status}`}>
          {report.status === 'pending' ? 'На рассмотрении' : 'Рассмотрена'}
        </span>,
        report.status === 'pending' && (
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={!!working}
            onClick={() => resolve(report.id)}
          >
            {working === report.id ? 'Сохраняем…' : 'Отметить рассмотренной'}
          </button>
        ),
      ],
    }
  })
  return (
    <section className="card feature-panel admin-insights">
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загружаем данные администрирования…</p>
      ) : (
        <>
          {!reportsOnly && (
            <>
              <div className="kpi-grid">
                {[
                  ['Пользователей', users.length],
                  ['Заблокировано', users.filter((u) => u.isBlocked).length],
                  ['Студентов', users.filter((u) => u.role === 'student').length],
                  ['Открытых жалоб', pending],
                ].map(([title, value]) => (
                  <div className="kpi-card" key={title}>
                    <div className="kpi-card__value">{value}</div>
                    <div className="kpi-card__label">{title}</div>
                  </div>
                ))}
              </div>
              <div className="admin-role-counts" aria-label="Пользователи по ролям">
                {Object.entries(roles).map(([role, label]) => (
                  <span key={role}>
                    {label} <strong>{users.filter((user) => user.role === role).length}</strong>
                  </span>
                ))}
              </div>
            </>
          )}
          {reportsOnly && (
            <section className="report-section">
              <div className="feature-toolbar">
                <h3>
                  Жалобы <span className="badge badge-direction">{reports.length}</span>
                </h3>
                <div className="report-filters">
                  <select
                    className="select"
                    aria-label="Причина жалобы"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    <option value="all">Все причины</option>
                    {Object.entries(reasons).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    aria-label="Статус жалобы"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="all">Все статусы</option>
                    <option value="pending">На рассмотрении</option>
                    <option value="resolved">Рассмотренные</option>
                  </select>
                  <select
                    className="select"
                    aria-label="Тип материала"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    <option value="all">Все материалы</option>
                    {Object.entries(targets).map(([value, [name]]) => (
                      <option value={value} key={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <CatalogSearch
                value={search}
                onChange={setSearch}
                label="Поиск жалоб по тексту или идентификатору"
              />
              <ReportTableView
                key={JSON.stringify([status, target, reason, search])}
                label="Жалобы"
                headers={['Дата', 'Материал', 'Причина', 'Статус', 'Действие']}
                rows={rows}
                emptyText="Жалоб по выбранным фильтрам нет."
              />
            </section>
          )}
          {!reportsOnly && (
            <section className="report-section">
              <h3>Последние действия</h3>
              <ReportTableView
                label="Последние действия"
                headers={['Время', 'Пользователь', 'Действие', 'Объект']}
                rows={[...(auditLogs || logs)]
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .map((log) => ({
                    id: log.id,
                    cells: [
                      new Date(log.timestamp).toLocaleString('ru-RU'),
                      users.find((user) => user.id === log.userId)?.fullName ||
                        log.userName ||
                        'Не зафиксирован',
                      auditActionLabels[log.actionType] || log.details || log.actionType,
                      [
                        auditObjectLabels[log.objectType] || log.objectType,
                        log.objectName ||
                          users.find((user) => user.id === log.objectId)?.fullName ||
                          log.objectId,
                        auditActionLabels[log.actionType] && log.details
                          ? `Причина: ${log.details}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · '),
                    ],
                  }))}
                emptyText="Действий пока нет."
              />
            </section>
          )}
        </>
      )}
    </section>
  )
}
