import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { communityApi } from '../api/community'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchTeamsRequest } from '../store/actions'
import { ProjectTeam, TeamRequest, TeamSeeker, User } from '../types/models'
import { CreateTeamModal } from './modals/CreateTeamModal'

export const TeamsPanel: React.FC<{ caseId?: string }> = ({ caseId }) => {
  const user = useAppSelector((s) => s.auth.currentUser), reduxTeams = useAppSelector((s) => s.students.teamsList)
  const dispatch = useAppDispatch()
  const [teams, setTeams] = useState<ProjectTeam[]>([]), [students, setStudents] = useState<User[]>([]), [requests, setRequests] = useState<TeamRequest[]>([]), [seekers, setSeekers] = useState<TeamSeeker[]>([])
  const [query, setQuery] = useState(''), [teamId, setTeamId] = useState(''), [message, setMessage] = useState(''), [stack, setStack] = useState(''), [tab, setTab] = useState('incoming'), [create, setCreate] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const refresh = async () => { const [t, s, r, q] = await Promise.all([apiClient.getTeams(), apiClient.getStudents(), communityApi.getTeamRequests(), caseId ? communityApi.getSeekers(caseId) : Promise.resolve([])]); setTeams(t); setStudents(s); setRequests(r); setSeekers(q) }
  useEffect(() => { refresh().catch((e) => setError(e.message)) }, [user?.id, caseId, reduxTeams])
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); setNotice(''); try { await fn(); await refresh(); dispatch(fetchTeamsRequest()); setNotice('Изменения сохранены') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const ownTeams = teams.filter((t) => t.leaderId === user?.id && (!caseId || ((!t.caseId || t.caseId === caseId) && (!t.recruitingCaseId || t.recruitingCaseId === caseId))))
  const selectedTeam = ownTeams.find((t) => t.id === teamId) || ownTeams[0]
  const visibleTeams = caseId ? teams.filter((t) => t.caseId === caseId || t.recruitingCaseId === caseId) : teams.filter((t) => t.leaderId === user?.id || t.members.some((m) => m.id === user?.id))
  const isInTeam = teams.some((t) => (t.caseId === caseId || t.recruitingCaseId === caseId) && (t.leaderId === user?.id || t.members.some((m) => m.id === user?.id)))
  const candidates = students.filter((s) => s.id !== user?.id && `${s.fullName} ${s.email}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
  const isIncoming = (r: TeamRequest) => r.kind === 'invitation' ? r.studentId === user?.id : teams.find((t) => t.id === r.teamId)?.leaderId === user?.id
  if (user?.role !== 'student') return <section className="card feature-panel"><h2>Команды кейса</h2>{error && <p role="alert">{error}</p>}{teams.filter((t) => t.caseId === caseId).map((team) => <div className="feature-row" key={team.id}><h3>{team.name}</h3>{team.members.map((m) => <Link key={m.id} to={`/profile/${m.id}`}>{m.name} · {m.role}</Link>)}</div>)}{!teams.some((t) => t.caseId === caseId) && <p>Команды пока не присоединились.</p>}</section>
  return <section className="card feature-panel"><div className="feature-toolbar"><h2>{caseId ? 'Поиск команды' : 'Мои команды'}</h2><button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>Создать команду</button></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {visibleTeams.map((team) => <article className="feature-row" key={team.id}><h3>{team.name}</h3><span>Капитан: <Link to={`/profile/${team.leaderId}`}>{team.leaderName}</Link></span><div className="action-row">{team.members.map((m) => <Link key={m.id} to={`/profile/${m.id}`}>{m.name}</Link>)}</div>{team.leaderId !== user.id && !team.members.some((m) => m.id === user.id) && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => communityApi.requestTeam(team.id, user.id, 'application', message || 'Хочу присоединиться к вашей команде'))}>Подать заявку в команду</button>}</article>)}
    {!visibleTeams.length && <p>Команд пока нет.</p>}
    {!!ownTeams.length && <><label>Команда для приглашений<select className="select" value={selectedTeam?.id || ''} onChange={(e) => setTeamId(e.target.value)}>{ownTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {caseId && selectedTeam && !selectedTeam.caseId && !selectedTeam.recruitingCaseId && <button className="btn btn-secondary" disabled={busy} onClick={() => act(() => communityApi.linkTeamToCase(selectedTeam.id, caseId))}>Открыть набор команды на этот кейс</button>}
      <label>Найти участника по имени или почте<input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      {query.trim() && candidates.map((student) => <div className="feature-toolbar" key={student.id}><Link to={`/profile/${student.id}`}>{student.fullName}</Link><span>{student.email}</span><button className="btn btn-secondary btn-sm" disabled={busy || selectedTeam?.members.some((m) => m.id === student.id)} onClick={() => selectedTeam && act(() => communityApi.requestTeam(selectedTeam.id, student.id, 'invitation', message || 'Приглашаем в нашу команду'))}>Пригласить в команду</button></div>)}
    </>}
    <label>Сообщение для заявки или приглашения<textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} /></label>
    {caseId && !isInTeam && <form className="feature-row" onSubmit={(e) => { e.preventDefault(); act(() => communityApi.saveSeeker(caseId, message, stack.split(',').map((s) => s.trim()).filter(Boolean))) }}><h3>Мини-анкета «Ищу команду»</h3><label>Технологии через запятую<input className="input" value={stack} onChange={(e) => setStack(e.target.value)} required /></label><p>Расскажите о себе в поле сообщения выше.</p><button className="btn btn-primary" disabled={busy || !message.trim()}>Опубликовать мини-анкету</button></form>}
    {caseId && <><h3>Студенты без команды</h3>{seekers.map((seeker) => <article className="feature-row" key={seeker.id}><Link to={`/profile/${seeker.studentId}`}>{students.find((s) => s.id === seeker.studentId)?.fullName || 'Профиль студента'}</Link><p>{seeker.message}</p><span>{seeker.techStack.join(', ')}</span>{selectedTeam && seeker.studentId !== user.id && <button className="btn btn-secondary" disabled={busy} onClick={() => act(() => communityApi.requestTeam(selectedTeam.id, seeker.studentId, 'invitation', message || 'Приглашаем по вашей мини-анкете'))}>Пригласить</button>}</article>)}</>}
    <div className="tabs-bar"><button className={`tab-btn ${tab === 'incoming' ? 'active' : ''}`} onClick={() => setTab('incoming')}>Входящие заявки</button><button className={`tab-btn ${tab === 'outgoing' ? 'active' : ''}`} onClick={() => setTab('outgoing')}>Исходящие заявки</button></div>
    {requests.filter((r) => tab === 'incoming' ? isIncoming(r) : r.senderId === user.id).map((r) => <article className="feature-row" key={r.id}><strong>{teams.find((t) => t.id === r.teamId)?.name}</strong><Link to={`/profile/${r.studentId}`}>{students.find((s) => s.id === r.studentId)?.fullName}</Link><p>{r.message}</p><span>{({ pending: 'На рассмотрении', accepted: 'Принято', rejected: 'Отклонено' })[r.status]}</span>{isIncoming(r) && r.status === 'pending' && <div className="action-row"><button className="btn btn-primary" disabled={busy} onClick={() => act(() => communityApi.decideTeamRequest(r.id, 'accepted'))}>Принять</button><button className="btn btn-secondary" disabled={busy} onClick={() => act(() => communityApi.decideTeamRequest(r.id, 'rejected'))}>Отклонить</button></div>}</article>)}
    <CreateTeamModal isOpen={create} onClose={() => { setCreate(false); refresh().catch((e) => setError(e.message)) }} />
  </section>
}
