import { LocalizedFileInput } from './LocalizedFileInput'
import { CalendarDays, Clock3, ExternalLink, MapPin, Monitor, Paperclip } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getEventPlan,
  saveEventPlan,
  type EventPlan,
  type EventRound,
  type EventTask,
} from '../api/events'
import type { CaseProject } from '../types/models'
import { uploadFile } from '../utils/files'
import { FileDownload } from './FileDownload'

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Yekaterinburg'
const newTask = (): EventTask => ({ title: '', statement: '', file_ids: [], max_score: 100 })
const newRound = (index: number): EventRound => ({
  title: `Тур ${index + 1}`,
  opens_at: '',
  due_at: '',
  rules: '',
  tasks: [newTask()],
})
const emptyPlan = (olympiad: boolean): EventPlan => ({
  subject: '',
  time_zone: timeZone,
  rounds: olympiad ? [newRound(0)] : [],
})
const dateInput = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const dateValue = (value: string) => (value ? new Date(value).toISOString() : '')
const showDate = (value: string, zone: string) =>
  new Date(value).toLocaleString('ru-RU', {
    timeZone: zone,
    dateStyle: 'short',
    timeStyle: 'short',
  })

export function EventPlanPanel({
  project,
  editable = false,
}: {
  project: CaseProject
  editable?: boolean
}) {
  const olympiad = project.kind === 'olympiad'
  const [plan, setPlan] = useState<EventPlan>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    getEventPlan(project.id)
      .then((value) => {
        if (active) setPlan({ ...value, rounds: value.rounds || [] })
      })
      .catch((e) => {
        if (!active) return
        if (e.status === 404 && editable) setPlan(emptyPlan(olympiad))
        else setError(e.status === 404 ? 'План мероприятия ещё не опубликован.' : e.message)
      })
    return () => {
      active = false
    }
  }, [project.id, editable, olympiad])

  const kindLabel = olympiad ? 'Олимпиада' : 'Хакатон'

  if (!plan)
    return (
      <p className="event-plan__message" role={error ? 'alert' : 'status'}>
        {error || 'Загрузка плана мероприятия…'}
      </p>
    )
  if (!editable)
    return (
      <section className="event-plan event-plan--summary" aria-label="План мероприятия">
        <header className="event-plan__header">
          <span className="event-plan__icon">
            <CalendarDays size={21} aria-hidden="true" />
          </span>
          <div>
            <h3>План мероприятия</h3>
            <p>{[kindLabel, plan.subject].filter(Boolean).join(' · ')}</p>
          </div>
        </header>
        {(plan.venue_name || plan.platform_name || plan.defense_at || plan.rounds.length > 0) && (
          <dl className="event-plan__facts">
            {plan.venue_name && (
              <div>
                <dt>
                  <MapPin size={16} aria-hidden="true" /> Очная площадка
                </dt>
                <dd>{plan.venue_name}</dd>
                {[plan.address, plan.building, plan.room].some(Boolean) && (
                  <dd className="event-plan__hint">
                    {[plan.address, plan.building, plan.room].filter(Boolean).join(' · ')}
                  </dd>
                )}
              </div>
            )}
            {plan.platform_name && (
              <div>
                <dt>
                  <Monitor size={16} aria-hidden="true" /> Онлайн-площадка
                </dt>
                <dd>
                  {plan.platform_url ? (
                    <a href={plan.platform_url} target="_blank" rel="noreferrer">
                      {plan.platform_name} <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : (
                    plan.platform_name
                  )}
                </dd>
              </div>
            )}
            {plan.defense_at && (
              <div>
                <dt>
                  <Clock3 size={16} aria-hidden="true" /> Защита проектов
                </dt>
                <dd>
                  <time dateTime={plan.defense_at}>
                    {showDate(plan.defense_at, plan.time_zone)}
                  </time>
                </dd>
              </div>
            )}
            {(plan.defense_at || plan.rounds.length > 0) && (
              <div>
                <dt>
                  <Clock3 size={16} aria-hidden="true" /> Часовой пояс расписания
                </dt>
                <dd>{plan.time_zone.replace(/_/g, ' ')}</dd>
              </div>
            )}
          </dl>
        )}
        {(plan.agenda || plan.regulations) && (
          <div className="event-plan__notes">
            {plan.agenda && (
              <section>
                <h4>Программа</h4>
                <p className="preserve-text">{plan.agenda}</p>
              </section>
            )}
            {plan.regulations && (
              <section>
                <h4>Регламент</h4>
                <p className="preserve-text">{plan.regulations}</p>
              </section>
            )}
          </div>
        )}
        {plan.rounds.length > 0 && (
          <section className="event-plan__schedule">
            <h4>Расписание туров</h4>
            <ol className="event-plan__rounds">
              {plan.rounds.map((round, index) => (
                <li className="event-plan__round" key={round.round_id || index}>
                  <div className="event-plan__round-header">
                    <span className="event-plan__number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div>
                      <h5>{round.title}</h5>
                      <p className="event-plan__dates">
                        <span>
                          Открытие{' '}
                          <time dateTime={round.opens_at}>
                            {showDate(round.opens_at, plan.time_zone)}
                          </time>
                        </span>
                        <span>
                          Срок сдачи{' '}
                          <time dateTime={round.due_at}>
                            {showDate(round.due_at, plan.time_zone)}
                          </time>
                        </span>
                      </p>
                    </div>
                  </div>
                  {round.rules && <p className="preserve-text event-plan__hint">{round.rules}</p>}
                  {(round.tasks || []).map((task) => (
                    <section className="event-plan__task" key={task.task_id}>
                      <div className="event-plan__actions">
                        <h6>{task.title}</h6>
                        <span className="event-plan__points">До {task.max_score} баллов</span>
                      </div>
                      <p className="preserve-text">{task.statement}</p>
                      {task.file_ids?.length > 0 && (
                        <div className="event-plan__files">
                          <Paperclip size={16} aria-hidden="true" />
                          {task.file_ids.map((id, fileIndex) => (
                            <FileDownload
                              key={id}
                              file={{
                                name:
                                  task.file_ids.length > 1
                                    ? `Материал ${fileIndex + 1}`
                                    : 'Материал задания',
                                url: `/api/v1/cases/${project.id}/rounds/${round.round_id}/tasks/${task.task_id}/files/${id}`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </li>
              ))}
            </ol>
          </section>
        )}
      </section>
    )

  const update = (patch: Partial<EventPlan>) => {
    setNotice('')
    setPlan((value) => ({ ...value!, ...patch }))
  }
  const changeRound = (index: number, patch: Partial<EventRound>) =>
    update({
      rounds: plan.rounds.map((round, i) => (i === index ? { ...round, ...patch } : round)),
    })
  const changeTask = (index: number, taskIndex: number, patch: Partial<EventTask>) =>
    changeRound(index, {
      tasks: plan.rounds[index].tasks.map((task, i) =>
        i === taskIndex ? { ...task, ...patch } : task,
      ),
    })
  const field = (key: keyof EventPlan, label: string, required = false, type = 'text') => (
    <label>
      {label}
      <input
        className="input"
        type={type}
        required={required}
        value={String(plan[key] || '')}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </label>
  )
  const onsite = project.workFormat !== 'дистанционный'
  const online = project.workFormat !== 'очный'
  return (
    <form
      className="event-plan event-plan--editor"
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        setNotice('')
        setBusy(true)
        try {
          await saveEventPlan(project.id, {
            ...plan,
            time_zone: timeZone,
            defense_at: plan.defense_at || undefined,
          })
          setPlan(await getEventPlan(project.id))
          setNotice('План сохранён. Мероприятие можно отправить на модерацию.')
        } catch (cause) {
          setError((cause as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <header className="event-plan__header">
        <span className="event-plan__icon">
          <CalendarDays size={21} aria-hidden="true" />
        </span>
        <div>
          <h3>План мероприятия</h3>
          <p>Укажите площадку и расписание для участников.</p>
        </div>
      </header>
      <fieldset
        disabled={busy}
        aria-label="Настройки мероприятия"
        className="event-plan__editor-fields"
      >
        <section className="event-plan__editor-section">
          <h4>Основные сведения</h4>
          {field('subject', olympiad ? 'Предмет олимпиады' : 'Тема хакатона', true)}
          {onsite && (
            <div className="event-plan__field-grid">
              {field('venue_name', 'Площадка', true)}
              {field('address', 'Адрес', true)}
              {field('building', 'Корпус')}
              {field('room', 'Аудитория')}
            </div>
          )}
          {online && (
            <div className="event-plan__field-grid">
              {field('platform_name', 'Онлайн-платформа', true)}
              {field('platform_url', 'Ссылка для участников', true, 'url')}
            </div>
          )}
        </section>
        <section className="event-plan__editor-section">
          <h4>{olympiad ? 'Регламент' : 'Программа и регламент'}</h4>
          {!olympiad && (
            <p className="event-plan__hint">
              Время вводится в часовом поясе устройства · {timeZone}.
            </p>
          )}
          <label>
            Общий регламент
            <textarea
              className="textarea"
              value={plan.regulations || ''}
              onChange={(e) => update({ regulations: e.target.value })}
            />
          </label>
          {!olympiad && (
            <>
              <label>
                Программа
                <textarea
                  className="textarea"
                  value={plan.agenda || ''}
                  onChange={(e) => update({ agenda: e.target.value })}
                />
              </label>
              <label>
                Время защиты
                <input
                  className="input"
                  type="datetime-local"
                  value={dateInput(plan.defense_at)}
                  onChange={(e) => update({ defense_at: dateValue(e.target.value) })}
                />
              </label>
            </>
          )}
        </section>
        {olympiad && (
          <section className="event-plan__editor-section">
            <h4>Туры и задания</h4>
            <p className="event-plan__hint">
              Время вводится в часовом поясе устройства · {timeZone}.
            </p>
            {plan.rounds.map((round, index) => (
              <section className="event-plan__round" key={round.round_id || index}>
                <div className="event-plan__actions">
                  <h5>Тур {index + 1}</h5>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={plan.rounds.length === 1}
                    onClick={() => update({ rounds: plan.rounds.filter((_, i) => i !== index) })}
                  >
                    Убрать тур
                  </button>
                </div>
                <label>
                  Название
                  <input
                    className="input"
                    required
                    value={round.title}
                    onChange={(e) => changeRound(index, { title: e.target.value })}
                  />
                </label>
                <div className="event-plan__field-grid">
                  <label>
                    Открытие заданий
                    <input
                      className="input"
                      required
                      type="datetime-local"
                      value={dateInput(round.opens_at)}
                      onChange={(e) => changeRound(index, { opens_at: dateValue(e.target.value) })}
                    />
                  </label>
                  <label>
                    Срок сдачи
                    <input
                      className="input"
                      required
                      type="datetime-local"
                      value={dateInput(round.due_at)}
                      onChange={(e) => changeRound(index, { due_at: dateValue(e.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Правила тура
                  <textarea
                    className="textarea"
                    value={round.rules || ''}
                    onChange={(e) => changeRound(index, { rules: e.target.value })}
                  />
                </label>
                {round.tasks.map((task, taskIndex) => (
                  <div className="event-plan__task" key={task.task_id || taskIndex}>
                    <h6>Задание {taskIndex + 1}</h6>
                    <label>
                      Название задачи
                      <input
                        className="input"
                        required
                        value={task.title}
                        onChange={(e) => changeTask(index, taskIndex, { title: e.target.value })}
                      />
                    </label>
                    <label>
                      Условие
                      <textarea
                        className="textarea"
                        required
                        value={task.statement}
                        onChange={(e) =>
                          changeTask(index, taskIndex, { statement: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Максимум баллов
                      <input
                        className="input"
                        required
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={task.max_score}
                        onChange={(e) =>
                          changeTask(index, taskIndex, { max_score: +e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Материалы задания
                      <LocalizedFileInput
                        className="input"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || [])
                          e.target.value = ''
                          if (!files.length) return
                          if (files.length + task.file_ids.length > 10) {
                            setError('К задаче можно прикрепить до десяти файлов.')
                            return
                          }
                          setBusy(true)
                          setError('')
                          try {
                            const uploaded = await Promise.all(files.map(uploadFile))
                            changeTask(index, taskIndex, {
                              file_ids: [
                                ...task.file_ids,
                                ...uploaded.map((file) => file.file_id!),
                              ],
                            })
                          } catch (cause) {
                            setError((cause as Error).message)
                          } finally {
                            setBusy(false)
                          }
                        }}
                      />
                    </label>
                    {!!task.file_ids.length && (
                      <div className="action-row">
                        <span>Файлов: {task.file_ids.length}</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => changeTask(index, taskIndex, { file_ids: [] })}
                        >
                          Убрать вложения
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={round.tasks.length === 1}
                      onClick={() =>
                        changeRound(index, { tasks: round.tasks.filter((_, i) => i !== taskIndex) })
                      }
                    >
                      Убрать задачу
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={round.tasks.length >= 50}
                  onClick={() => changeRound(index, { tasks: [...round.tasks, newTask()] })}
                >
                  Добавить задачу
                </button>
              </section>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={plan.rounds.length >= 20}
              onClick={() => update({ rounds: [...plan.rounds, newRound(plan.rounds.length)] })}
            >
              Добавить тур
            </button>
          </section>
        )}
        <button className="btn btn-primary" disabled={busy}>
          Сохранить план мероприятия
        </button>
      </fieldset>
      {error && (
        <p className="form-error event-plan__message" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="event-plan__message" role="status">
          {notice}
        </p>
      )}
    </form>
  )
}
