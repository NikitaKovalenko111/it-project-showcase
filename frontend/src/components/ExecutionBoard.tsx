import { CaseComments } from './CaseComments'
import { ReportTableView } from './ReportTableView'
import { useConfirm } from './ConfirmProvider'
import { DeadlineHistory } from './DeadlineHistory'
import { OlympiadStandings } from './OlympiadStandings'
import { EventPlanPanel } from './EventPlanPanel'
import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, FileCheck2, FileText, Users } from 'lucide-react'
import { CaseProject } from '../types/models'
import { Execution } from '../types/execution'
import { communityApi } from '../api/community'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCasesRequest, fetchCaseByIdRequest } from '../store/actions'
import { canManageCase } from '../utils/access'
import { SharedProjectPlan } from './SharedProjectPlan'
import { ExecutionDetail } from './ExecutionDetail'
import { CaseApplications } from './CaseApplications'
import { PaginatedGrid } from './PaginatedGrid'
import { apiClient } from '../api/client'
import { apiRuntime } from '../api/runtime'
import { caseStatusLabels, matchesSearch } from '../utils/publication'

export const ExecutionBoard: React.FC<{ project: CaseProject; initialView?: string }> = ({
  project,
  initialView = 'teams',
}) => {
  const confirm = useConfirm()
  const dispatch = useAppDispatch(),
    user = useAppSelector((s) => s.auth.currentUser)
  const manager = canManageCase(user, project),
    student = user?.role === 'student',
    olympiad = project.kind === 'olympiad'
  const live = apiRuntime.mode === 'live'
  const liveOlympiad = live && olympiad
  const hasEventPlan = project.kind === 'hackathon' || olympiad
  const curator = user?.role === 'curator'
  const canSubmit =
    live && user?.role === 'company' && manager && ['draft', 'revision'].includes(project.status)
  const [params] = useSearchParams()
  const [entries, setEntries] = useState<Execution[]>([]),
    [selected, setSelected] = useState(''),
    [tab, setTab] = useState('all'),
    [search, setSearch] = useState('')
  const [view, setView] = useState(
      params.get('view') === 'event' && hasEventPlan ? 'event' : initialView,
    ),
    [finished, setFinished] = useState(project.status === 'completed'),
    [loading, setLoading] = useState(true)
  const [ranking, setRanking] = useState<{
    complete: boolean
    items: { id: string; name: string; score: number; max: number; place?: number }[]
  }>({ complete: false, items: [] })
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const refresh = async () => {
    const [e, r] = await Promise.all([
      communityApi.getExecutions(project.id),
      curator || canSubmit || liveOlympiad
        ? { complete: false, items: [] }
        : communityApi.getLeaderboard(project.id),
    ])
    if (params.get('application')) setView('teams')
    if (params.get('application'))
      setSelected(
        e.find(
          (x) =>
            x.applicationId === params.get('application') ||
            `app_${x.id}` === params.get('application'),
        )?.id || '',
      )
    setEntries(student ? e.filter((x) => x.members.some((m) => m.id === user?.id)) : e)
    setRanking(r)
    setFinished(r.complete || (!manager && project.status === 'completed'))
  }
  const changeResults = async (publish: boolean) => {
    if (
      busy ||
      !(await confirm(
        publish
          ? 'Опубликовать итоговые места?'
          : 'Отозвать опубликованные итоги? Решения и оценки сохранятся.',
      ))
    )
      return
    setBusy(true)
    setError('')
    try {
      await (publish
        ? communityApi.finalizeResults(project.id)
        : communityApi.withdrawResults(project.id))
      await refresh()
      dispatch(fetchCasesRequest())
      dispatch(fetchCaseByIdRequest(project.id))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const submitForReview = async () => {
    setBusy(true)
    setError('')
    try {
      await apiClient.submitCase(project.id)
      dispatch(fetchCaseByIdRequest(project.id))
      dispatch(fetchCasesRequest())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    setSelected(params.get('execution') || '')
    setTab('all')
    setLoading(true)
    setError('')
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [project.id, user?.id, params.get('application'), params.get('execution')])
  const own = student ? entries[0] : undefined,
    entry = student ? own : entries.find((e) => e.id === selected)
  const visible = entries.filter(
    (e) =>
      (tab === 'all' ||
        e.status === tab ||
        (tab === 'stage_review' && e.milestones?.some((m) => m.status === 'submitted'))) &&
      matchesSearch(
        search,
        e.name,
        e.members.map((member) => member.name),
      ),
  )
  const completed = own?.milestones?.filter((m) => m.status === 'accepted').length || 0,
    count = own?.milestones?.length || 0
  const tabs = student
    ? [
        ['teams', 'Контрольные точки'],
        ['submission', 'Результат и оценка'],
        ['members', own?.teamId ? 'Моя команда' : 'Участник'],
        ['teamDiscussion', 'Обсуждение команды'],
        ['discussion', 'Обсуждение и файлы'],
        ['results', 'Итоги'],
      ]
    : [
        [
          'teams',
          curator ? 'Работы студентов' : olympiad ? 'Участники и работы' : 'Команды и решения',
        ],
        ['plan', olympiad && !live ? 'Расписание туров' : 'Общий план реализации'],
        ...(!curator && !canSubmit ? [['results', 'Итоги и рейтинг']] : []),
      ]
  return (
    <div className={`execution-board ${student ? 'student-execution' : 'organizer-execution'}`}>
      <Link className="workspace-back btn btn-secondary" to="/workspace">
        <ArrowLeft size={18} /> {student ? 'Активные проекты' : 'К списку проектов'}
      </Link>
      <header className="card execution-header">
        <div className="execution-heading">
          <div>
            <div className="action-row">
              <span className="badge badge-direction">
                {
                  {
                    case: 'Кейс',
                    hackathon: 'Хакатон',
                    olympiad: 'Олимпиада',
                    internship: 'Стажировка',
                  }[project.kind || 'case']
                }
              </span>
              <span className="badge badge-status status-in_progress">
                {finished ? 'Завершён' : caseStatusLabels[project.status] || 'Выполняется'}
              </span>
            </div>
            <h1>{project.title}</h1>
            <p>
              Заказчик: <strong>{project.companyName}</strong>
              {student && own && (
                <>
                  {' '}
                  · {own.teamId ? 'Команда' : 'Участник'}: <strong>{own.name}</strong>
                </>
              )}
            </p>
          </div>
          <div className="action-row">
            <Link className="btn btn-secondary btn-sm" to={`/cases/${project.id}`}>
              <FileText size={16} /> Описание задания
            </Link>
            {student &&
              own &&
              !finished &&
              !own.evaluation &&
              (liveOlympiad || own.canSubmitResult !== false) && (
                <button className="btn btn-primary btn-sm" onClick={() => setView('submission')}>
                  <FileCheck2 size={16} /> Сдать результат
                </button>
              )}
          </div>
        </div>
        {canSubmit && (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={submitForReview}>
            Отправить на модерацию
          </button>
        )}
        {student ? (
          count > 0 && (
            <div className="execution-own-progress">
              <div>
                <strong>Выполнение контрольных точек</strong>
                <span>
                  {completed} из {count}
                </span>
              </div>
              <progress value={completed} max={count} aria-label="Выполнение контрольных точек" />
            </div>
          )
        ) : (
          <div className="execution-stats">
            <span>
              <strong>{entries.length}</strong>{' '}
              {olympiad && project.participationFormat === 'individual'
                ? 'участников'
                : 'команд / участников'}
            </span>
            {!curator && (
              <>
                <span>
                  <strong>{entries.filter((e) => e.submission).length}</strong> сданных работ
                </span>
                <span>
                  <strong>{entries.filter((e) => e.evaluation).length}</strong> оценено
                </span>
              </>
            )}
          </div>
        )}
      </header>
      <div className="uust-container attached-tabs execution-sections">
        <nav className="uust-tabs-row workspace-navigation" aria-label="Разделы проекта">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              className={`uust-tab ${view === value ? 'active' : ''}`}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
          {!student && (
            <button
              className={`uust-tab ${view === 'discussion' ? 'active' : ''}`}
              onClick={() => setView('discussion')}
            >
              Обсуждение и файлы
            </button>
          )}

          {hasEventPlan && (
            <button
              className={`uust-tab ${view === 'event' ? 'active' : ''}`}
              onClick={() => setView('event')}
            >
              План мероприятия
            </button>
          )}
          {live && manager && (
            <button
              className={`uust-tab ${view === 'deadlines' ? 'active' : ''}`}
              onClick={() => setView('deadlines')}
            >
              Сроки проекта
            </button>
          )}
          {manager && (
            <button
              className={`uust-tab ${view === 'applications' ? 'active' : ''}`}
              onClick={() => setView('applications')}
            >
              {hasEventPlan ? 'Регистрации' : 'Заявки на участие'}
            </button>
          )}
        </nav>
        <div className="uust-box">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status">Загрузка выполнений…</p>
          ) : (
            <>
              {view === 'applications' && manager && (
                <CaseApplications
                  key={project.id}
                  caseId={project.id}
                  registrations={live && hasEventPlan}
                />
              )}
              {view === 'discussion' && <CaseComments caseId={project.id} />}
              {view === 'deadlines' && live && manager && (
                <DeadlineHistory
                  project={project}
                  editable={
                    user?.role === 'company' && ['open', 'in_progress'].includes(project.status)
                  }
                  onSaved={refresh}
                />
              )}
              {view === 'event' && hasEventPlan && (
                <EventPlanPanel
                  project={project}
                  editable={live ? canSubmit && !entries.length : manager}
                />
              )}
              {view === 'plan' && (
                <SharedProjectPlan
                  project={project}
                  editable={live ? canSubmit && !entries.length : manager && !finished}
                  onOpenDeadlines={
                    live &&
                    manager &&
                    user?.role === 'company' &&
                    ['open', 'in_progress'].includes(project.status)
                      ? () => setView('deadlines')
                      : undefined
                  }
                  onSaved={refresh}
                />
              )}
              {((student && ['teams', 'submission', 'members', 'teamDiscussion'].includes(view)) ||
                (!student && view === 'teams' && entry)) &&
                entry && (
                  <ExecutionDetail
                    key={entry.id}
                    project={project}
                    entry={entry}
                    manager={manager}
                    finished={finished}
                    onChange={refresh}
                    section={
                      student
                        ? view === 'teams'
                          ? 'stages'
                          : view === 'teamDiscussion'
                            ? 'discussion'
                            : view
                        : undefined
                    }
                    onBack={student ? undefined : () => setSelected('')}
                  />
                )}
              {student &&
                !own &&
                ['teams', 'submission', 'members', 'teamDiscussion'].includes(view) && (
                  <div className="empty-state">
                    <h2>Выполнение пока недоступно</h2>
                    <p>
                      {live
                        ? 'Дождитесь одобрения заявки организатором.'
                        : 'Для кейса дождитесь одобрения заявки. Запись на олимпиаду и хакатон подтверждается автоматически.'}
                    </p>
                    <Link className="btn btn-secondary btn-sm" to={`/cases/${project.id}`}>
                      Открыть задание
                    </Link>
                  </div>
                )}
              {!student && view === 'teams' && !entry && (
                <>
                  <div className="execution-filter">
                    {!curator && (
                      <label className="catalog-sort">
                        Статус работы
                        <select
                          className="select"
                          value={tab}
                          onChange={(event) => setTab(event.target.value)}
                        >
                          <option value="all">Все работы</option>
                          <option value="active">В работе</option>
                          <option value="stage_review">Этапы на проверке</option>
                          <option value="submitted">Сданные решения</option>
                          <option value="evaluated">Оценённые решения</option>
                        </select>
                      </label>
                    )}
                    <label className="sr-only" htmlFor="execution-search">
                      Поиск команды или участника
                    </label>
                    <input
                      id="execution-search"
                      className="input"
                      placeholder="Команда или участник"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <PaginatedGrid className="execution-rows">
                    {visible.map((e) => (
                      <article
                        className={`card execution-card ${curator ? 'execution-card--observer' : ''}`}
                        key={e.id}
                      >
                        {!curator && (
                          <span className="badge badge-direction">
                            {e.status === 'evaluated'
                              ? 'Оценено'
                              : e.status === 'submitted'
                                ? 'Сдано'
                                : finished
                                  ? 'Не сдано'
                                  : 'В работе'}
                          </span>
                        )}
                        <h3>{e.name}</h3>
                        <p>
                          {olympiad && !e.teamId
                            ? 'Индивидуальный зачёт'
                            : e.members.map((m) => m.name).join(', ')}
                          <small className="execution-progress">
                            {olympiad ? (
                              'Результат определяется баллами за задания.'
                            ) : (
                              <>
                                Этапы:{' '}
                                {e.milestones?.filter((m) => m.status === 'accepted').length || 0} /{' '}
                                {e.milestones?.length || 0}
                                {' · '}На проверке:{' '}
                                {e.milestones?.filter((m) => m.status === 'submitted').length || 0}
                              </>
                            )}
                          </small>
                        </p>
                        {!curator && (
                          <strong>
                            {e.evaluation
                              ? `${e.evaluation.totalScore} / ${e.evaluation.maxScore}`
                              : 'Без оценки'}
                          </strong>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelected(e.id)}
                        >
                          {manager ? 'Открыть выполнение' : 'Просмотреть выполнение'}
                        </button>
                      </article>
                    ))}
                  </PaginatedGrid>
                  {!visible.length && (
                    <p className="empty-state">Участников по выбранному фильтру нет.</p>
                  )}
                </>
              )}
              {view === 'results' && (
                <section className="execution-leaderboard">
                  <div className="feature-toolbar leaderboard-toolbar">
                    <div>
                      <h2>
                        {liveOlympiad
                          ? 'Результаты туров'
                          : ranking.complete
                            ? 'Итоговая таблица'
                            : 'Итоги ещё не опубликованы'}
                      </h2>
                    </div>
                    {manager && !liveOlympiad && (!live || !ranking.complete) && (
                      <button
                        type="button"
                        className={`btn btn-sm ${ranking.complete ? 'btn-secondary' : 'btn-primary'}`}
                        disabled={
                          busy ||
                          (!ranking.complete &&
                            (live
                              ? !ranking.items.length || ranking.items.some((row) => row.max <= 0)
                              : !entries.some((e) => e.submission) ||
                                entries.some((e) => e.submission && !e.evaluation)))
                        }
                        onClick={() => void changeResults(!ranking.complete)}
                      >
                        {ranking.complete ? 'Отозвать итоги' : 'Опубликовать итоги'}
                      </button>
                    )}
                  </div>
                  {(ranking.complete || (manager && !liveOlympiad)) && (
                    <ReportTableView
                      label="Итоги проекта"
                      headers={[
                        ...(ranking.complete ? ['Место'] : []),
                        'Команда / участник',
                        'Баллы',
                      ]}
                      rows={ranking.items
                        .filter((row) => !ranking.complete || !live || row.place)
                        .map((row) => ({
                          id: row.id,
                          cells: [
                            ...(ranking.complete
                              ? [
                                  row.place ??
                                    ranking.items.findIndex((item) => item.score === row.score) + 1,
                                ]
                              : []),
                            row.name,
                            `${row.score} / ${row.max}`,
                          ],
                        }))}
                      emptyText="Оценённых результатов пока нет."
                    />
                  )}
                  {liveOlympiad && (manager || student) && (
                    <OlympiadStandings caseId={project.id} entries={entries} manager={manager} />
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
