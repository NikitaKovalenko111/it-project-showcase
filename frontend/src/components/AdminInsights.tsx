import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { communityApi } from '../api/community'
import { ContentReport, User, AuditLog } from '../types/models'

export const AdminInsights: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]), [reports, setReports] = useState<ContentReport[]>([]), [logs, setLogs] = useState<AuditLog[]>([]), [error, setError] = useState('')
  const refresh = () => Promise.all([apiClient.getUsers(), communityApi.getReports(), apiClient.getAuditLogs()]).then(([u, r, l]) => { setUsers(u); setReports(r); setLogs(l) }).catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [])
  return <section className="card feature-panel"><h2>Администрирование платформы</h2>{error && <p role="alert">{error}</p>}<div className="kpi-grid">{[['Пользователей', users.length], ['Заблокировано', users.filter((u) => u.isBlocked).length], ['Студентов без куратора', users.filter((u) => u.role === 'student' && !u.studentProfile?.curatorId).length], ['Жалоб на рассмотрении', reports.filter((r) => r.status === 'pending').length]].map(([title, value]) => <div className="kpi-card" key={title}><strong>{value}</strong><p>{title}</p></div>)}</div>
    <h3>Пользователи по ролям</h3>{['student', 'company', 'curator', 'university', 'admin'].map((role) => <p key={role}>{({ student: 'Студенты', company: 'Представители компаний', curator: 'Кураторы', university: 'Сотрудники', admin: 'Администраторы' })[role]}: {users.filter((u) => u.role === role).length}</p>)}
    <h3>Жалобы</h3>{!reports.length && <p>Жалоб нет.</p>}{reports.map((r) => <article className="feature-row" key={r.id}><Link to={r.targetType === 'project' ? `/student-projects/${r.targetId}` : r.targetType === 'user' ? `/profile/${r.targetId}` : r.targetType === 'case' ? `/cases/${r.targetId}` : '/moderation'}>{r.targetType} · {r.targetId}</Link><strong>{r.reason}</strong><p>{r.message}</p><span>{r.status === 'pending' ? 'На рассмотрении' : 'Рассмотрена'}</span>{r.status === 'pending' && <button className="btn btn-secondary" onClick={async () => { try { await communityApi.resolveReport(r.id); await refresh() } catch (e) { setError((e as Error).message) } }}>Отметить рассмотренной</button>}</article>)}
    <h3>Последние действия</h3>{[...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10).map((log) => <p key={log.id}>{new Date(log.timestamp).toLocaleString('ru-RU')} · {log.userName} · {log.details || log.actionType}</p>)}
  </section>
}
