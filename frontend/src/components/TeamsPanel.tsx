import { matchesSearch } from '../utils/publication'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users, X } from 'lucide-react'
import { apiClient } from '../api/client'
import { communityApi } from '../api/community'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchTeamsRequest } from '../store/actions'
import { CaseProject, ProjectTeam, TeamRequest, TeamSeeker, User } from '../types/models'
import { CreateTeamModal } from './modals/CreateTeamModal'
import { PaginatedGrid } from './PaginatedGrid'
import { TeamMembers } from './TeamMembers'

export const TeamsPanel: React.FC<{
  caseId?: string
  searchMode?: boolean
  initialView?: 'teams' | 'requests'
}> = ({ caseId, searchMode = false, initialView }) => {
  const user = useAppSelector((s) => s.auth.currentUser),
    dispatch = useAppDispatch()
  const [teams, setTeams] = useState<ProjectTeam[]>([]),
    [students, setStudents] = useState<User[]>([])
  const [requests, setRequests] = useState<TeamRequest[]>([]),
    [seekers, setSeekers] = useState<TeamSeeker[]>([]),
    [cases, setCases] = useState<CaseProject[]>([])
  const [selected, setSelected] = useState(''),
    [query, setQuery] = useState(''),
    [inviteMessage, setInviteMessage] = useState('')
  const [about, setAbout] = useState(''),
    [stack, setStack] = useState(''),
    [preferredCase, setPreferredCase] = useState(''),
    [filterCase, setFilterCase] = useState(caseId || '')
  const [teamQuery, setTeamQuery] = useState(''),
    [view, setView] = useState(initialView || 'teams'),
    [direction, setDirection] = useState('incoming')
  const [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true)
  const refresh = async () => {
    const [t, s, r, q, c] = await Promise.all([
      apiClient.getTeams(),
      apiClient.getStudents(),
      communityApi.getTeamRequests(),
      communityApi.getSeekers(),
      apiClient.getCases(),
    ])
    setTeams(t)
    setStudents(s)
    setRequests(r)
    setSeekers(q)
    setCases(c)
    return q
  }
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    refresh()
      .then((q) => {
        if (!active) return
        const own =
          q.find((s) => s.studentId === user?.id && !s.caseId) ||
          q.find((s) => s.studentId === user?.id)
        setAbout(own?.message || '')
        setStack(own?.techStack.join(', ') || '')
        setPreferredCase(own?.caseId || '')
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
  }, [user?.id, caseId])
  const act = async (fn: () => Promise<unknown>, success = 'Изменения сохранены') => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      await refresh()
      dispatch(fetchTeamsRequest())
      setNotice(success)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const mine = teams.filter(
      (t) => t.leaderId === user?.id || t.members.some((m) => m.id === user?.id),
    ),
    led = mine.filter((t) => t.leaderId === user?.id)
  const managed = led.find((t) => t.id === selected)
  const incoming = (r: TeamRequest) =>
    r.kind === 'invitation' ? r.studentId === user?.id : led.some((t) => t.id === r.teamId)
  const filteredRequests = requests.filter((r) =>
    direction === 'incoming' ? incoming(r) : r.senderId === user?.id,
  )
  const pending = (t: ProjectTeam, id: string) =>
    requests.some((r) => r.teamId === t.id && r.studentId === id && r.status === 'pending')
  const recruitable = cases.filter(
    (c) => c.participationFormat !== 'individual' && c.status === 'open',
  )
  const shown = searchMode
    ? teams.filter(
        (t) =>
          !t.caseId &&
          t.leaderId !== user?.id &&
          !t.members.some((m) => m.id === user?.id) &&
          matchesSearch(teamQuery, t.name) &&
          (!filterCase || t.recruitingCaseId === filterCase),
      )
    : caseId
      ? teams.filter((t) => t.caseId === caseId || t.recruitingCaseId === caseId)
      : mine
  const candidates = seekers.filter(
    (s) =>
      s.studentId !== user?.id &&
      (!managed?.recruitingCaseId || !s.caseId || s.caseId === managed.recruitingCaseId),
  )
  if (!user) return null
  if (user.role !== 'student')
    return (
      <section className="card teams-panel">
        <h2>Команды проекта</h2>
        <PaginatedGrid className="teams-grid">
          {shown.map((t) => (
            <article className="team-card" key={t.id}>
              <h3>{t.name}</h3>
              <TeamMembers members={t.members} leaderId={t.leaderId} students={students} />
            </article>
          ))}
        </PaginatedGrid>
        {!shown.length && <p className="empty-state">Команд пока нет.</p>}
      </section>
    )
  return (
    <section className="teams-panel">
      {!searchMode && (
        <>
          <div className="team-panel-header">
            <h2>{view === 'requests' ? 'Заявки и приглашения' : 'Составы команд'}</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>
              <Users size={16} /> Создать команду
            </button>
          </div>
          {!initialView && (
            <nav className="tabs-bar team-navigation" aria-label="Мои команды">
              <button
                className={`tab-btn ${view === 'teams' ? 'active' : ''}`}
                onClick={() => setView('teams')}
              >
                Составы команд
              </button>
              <button
                className={`tab-btn ${view === 'requests' ? 'active' : ''}`}
                onClick={() => {
                  setView('requests')
                  setSelected('')
                }}
              >
                Заявки и приглашения
              </button>
            </nav>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Загрузка команд…</p>
      ) : (
        <>
          {searchMode && (
            <>
              <form
                className="seeker-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  act(
                    () =>
                      communityApi.saveSeeker(preferredCase || undefined, about, stack.split(',')),
                    'Анкета опубликована. Капитаны видят её в списке кандидатов и могут пригласить вас.',
                  )
                }}
              >
                <div>
                  <h2>Ваша анкета «Ищу команду»</h2>
                  <p>
                    Расскажите о себе и желаемой роли. Можно искать команду без привязки к заданию.
                  </p>
                </div>
                <label>
                  О себе и желаемой роли
                  <textarea
                    className="textarea"
                    required
                    maxLength={2000}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Что умеете, какую задачу хотите взять и когда готовы участвовать"
                  />
                </label>
                <div className="team-form-row">
                  <label>
                    Навыки и технологии
                    <input
                      className="input"
                      maxLength={500}
                      value={stack}
                      onChange={(e) => setStack(e.target.value)}
                      placeholder="React, Python, дизайн"
                    />
                  </label>
                  <label>
                    Предпочтительный проект · необязательно
                    <select
                      className="select"
                      value={preferredCase}
                      onChange={(e) => setPreferredCase(e.target.value)}
                    >
                      <option value="">Любой проект</option>
                      {recruitable.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="btn btn-primary btn-sm" disabled={busy}>
                  {seekers.some(
                    (s) => s.studentId === user.id && s.caseId === (preferredCase || undefined),
                  )
                    ? 'Обновить анкету'
                    : 'Опубликовать анкету'}
                </button>
              </form>
              <label className="team-search-field">
                Поиск команды
                <input
                  className="input"
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                  placeholder="Название команды"
                />
              </label>
              <div className="team-search-toolbar">
                <div>
                  <h2>Команды, в которые можно вступить</h2>
                  <p>
                    Отправьте кандидатуру капитану. В состав вы попадёте после его подтверждения.
                  </p>
                </div>
                <label>
                  Проект
                  <select
                    className="select"
                    value={filterCase}
                    onChange={(e) => setFilterCase(e.target.value)}
                  >
                    <option value="">Все проекты</option>
                    {recruitable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {(searchMode || view === 'teams') && (
            <>
              <PaginatedGrid className="teams-grid">
                {shown.map((t) => {
                  const member = t.leaderId === user.id || t.members.some((m) => m.id === user.id),
                    isPending = pending(t, user.id)
                  return (
                    <article className="team-card" key={t.id}>
                      <header>
                        <h3>{t.name}</h3>
                        <span className="badge badge-direction">{t.members.length} участн.</span>
                      </header>
                      {t.description && <p>{t.description}</p>}
                      {t.recruitingCaseId && (
                        <p className="team-project">
                          Набор: {cases.find((c) => c.id === t.recruitingCaseId)?.title || 'Проект'}
                        </p>
                      )}
                      <TeamMembers members={t.members} leaderId={t.leaderId} students={students} />
                      <footer>
                        {!searchMode && t.leaderId === user.id ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelected(t.id)
                              setFilterCase(t.recruitingCaseId || '')
                            }}
                          >
                            <UserPlus size={16} /> Пригласить участников
                          </button>
                        ) : searchMode && !member ? (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={busy || isPending}
                            onClick={() =>
                              act(
                                () =>
                                  communityApi.requestTeam(
                                    t.id,
                                    user.id,
                                    'application',
                                    about.trim() || 'Хочу присоединиться к вашей команде',
                                  ),
                                'Кандидатура отправлена капитану. Ответ появится в разделе заявок.',
                              )
                            }
                          >
                            {isPending ? 'Заявка отправлена' : 'Отправить кандидатуру'}
                          </button>
                        ) : (
                          <small>
                            {member ? 'Вы в составе команды' : 'Приглашениями управляет капитан'}
                          </small>
                        )}
                      </footer>
                    </article>
                  )
                })}
              </PaginatedGrid>
              {!shown.length && (
                <div className="empty-state">
                  <Users size={28} />
                  <p>
                    {searchMode
                      ? 'Сейчас нет команд с открытым набором. Опубликуйте анкету — капитан сможет пригласить вас.'
                      : 'Вы пока не состоите в командах. Создайте команду или примите приглашение.'}
                  </p>
                </div>
              )}
            </>
          )}
          {!searchMode && view === 'teams' && managed && (
            <div className="modal-backdrop">
              <section
                className="modal-dialog team-management"
                role="dialog"
                aria-modal="true"
                aria-label="Приглашение участников"
              >
                <div className="feature-toolbar">
                  <h3>Набор в «{managed.name}»</h3>
                  <button
                    type="button"
                    className="close-btn"
                    aria-label="Закрыть окно"
                    onClick={() => setSelected('')}
                  >
                    <X size={20} />
                  </button>
                </div>
                <p>Вы капитан. Приглашённый студент появится в составе только после согласия.</p>
                {!managed.caseId && (
                  <div className="team-form-row">
                    <label>
                      Для какого проекта набираете команду
                      <select
                        className="select"
                        value={filterCase}
                        onChange={(e) => setFilterCase(e.target.value)}
                      >
                        <option value="">Выберите проект</option>
                        {recruitable.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy || !filterCase}
                      onClick={() =>
                        act(
                          () => communityApi.linkTeamToCase(managed.id, filterCase),
                          'Набор на проект открыт. Команда доступна в поиске.',
                        )
                      }
                    >
                      Открыть набор
                    </button>
                  </div>
                )}
                <label>
                  Сообщение к приглашению
                  <textarea
                    className="textarea"
                    maxLength={2000}
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                  />
                </label>
                <label>
                  Поиск студента по имени или email
                  <input
                    className="input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Введите имя или email"
                  />
                </label>
                <h4>{query.trim() ? 'Результаты поиска' : 'Кандидаты, которые ищут команду'}</h4>
                <PaginatedGrid className="request-list">
                  {(query.trim()
                    ? students.filter((s) => matchesSearch(query, s.fullName, s.email))
                    : students.filter((s) => candidates.some((c) => c.studentId === s.id))
                  )
                    .filter((s) => s.id !== user.id && !managed.members.some((m) => m.id === s.id))
                    .map((s) => (
                      <article className="candidate-row" key={s.id}>
                        <div>
                          <Link to={`/profile/${s.id}`}>
                            <strong>{s.fullName}</strong>
                          </Link>
                          <p>{candidates.find((c) => c.studentId === s.id)?.message || s.email}</p>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busy || pending(managed, s.id)}
                          onClick={() =>
                            act(
                              () =>
                                communityApi.requestTeam(
                                  managed.id,
                                  s.id,
                                  'invitation',
                                  inviteMessage.trim() || 'Приглашаем в нашу команду',
                                ),
                              'Приглашение отправлено студенту.',
                            )
                          }
                        >
                          {pending(managed, s.id) ? 'Ожидаем ответ' : 'Пригласить'}
                        </button>
                      </article>
                    ))}
                </PaginatedGrid>
                {!query.trim() && !candidates.length && (
                  <p className="empty-state">
                    Анкет пока нет. Найдите участника по имени или email.
                  </p>
                )}
              </section>
            </div>
          )}
          {!searchMode && view === 'requests' && (
            <>
              <div className="action-row request-directions">
                <button
                  className={`btn ${direction === 'incoming' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setDirection('incoming')}
                >
                  Входящие
                </button>
                <button
                  className={`btn ${direction === 'outgoing' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setDirection('outgoing')}
                >
                  Исходящие
                </button>
              </div>
              {!filteredRequests.length && (
                <div className="empty-state request-empty">
                  <UserPlus size={28} />
                  <h3>
                    {direction === 'incoming'
                      ? 'Входящих заявок и приглашений пока нет'
                      : 'Исходящих заявок и приглашений пока нет'}
                  </h3>
                  <p>
                    {direction === 'incoming'
                      ? 'Здесь появятся приглашения в команды и заявки в команды, где вы капитан.'
                      : 'Здесь можно отслеживать отправленные кандидатуры и приглашения участников.'}
                  </p>
                </div>
              )}
              <PaginatedGrid className="request-list">
                {filteredRequests.map((r) => (
                  <article className="team-request" key={r.id}>
                    <div className="feature-toolbar">
                      <h3>{teams.find((t) => t.id === r.teamId)?.name}</h3>
                      <span className="badge badge-direction">
                        {
                          { pending: 'Ожидает ответа', accepted: 'Принято', rejected: 'Отклонено' }[
                            r.status
                          ]
                        }
                      </span>
                    </div>
                    <p>
                      {r.kind === 'invitation' ? 'Приглашение в команду' : 'Заявка на вступление'} ·{' '}
                      {students.find((s) => s.id === r.studentId)?.fullName}
                    </p>
                    <p className="preserve-text">{r.message}</p>
                    {incoming(r) && r.status === 'pending' && (
                      <div className="action-row">
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => communityApi.decideTeamRequest(r.id, 'accepted'),
                              'Участник добавлен в состав команды.',
                            )
                          }
                        >
                          Принять
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() =>
                            act(() => communityApi.decideTeamRequest(r.id, 'rejected'))
                          }
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </PaginatedGrid>
            </>
          )}
        </>
      )}
      {create && (
        <CreateTeamModal
          isOpen
          onClose={() => {
            setCreate(false)
            refresh().catch((e) => setError(e.message))
          }}
        />
      )}
    </section>
  )
}
