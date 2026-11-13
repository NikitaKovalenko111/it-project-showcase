import { useEffect, useState } from 'react'
import { axiosInstance } from '../api/http'
import { collectNumbered } from '../api/backend'
import { getEventPlan } from '../api/events'
import type { CaseProject } from '../types/models'
import { ReportTableView } from './ReportTableView'

type DeadlineChange = {
  change_id: string
  stage_id?: string
  round_id?: string
  previous_due_at?: string
  due_at: string
  reason: string
  changed_at: string
}
type Target = { path: string; label: string }
const dateLabel = (value?: string) => (value ? new Date(value).toLocaleString('ru-RU') : '—')

export function DeadlineHistory({
  project,
  editable,
  onSaved,
}: {
  project: CaseProject
  editable: boolean
  onSaved: () => Promise<void>
}) {
  const base = `/cases/${project.id}`
  const [history, setHistory] = useState<DeadlineChange[]>([])
  const [targets, setTargets] = useState<Target[]>([{ path: '', label: 'Общий срок' }])
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const isEvent = project.kind === 'olympiad' || project.kind === 'hackathon'
    Promise.allSettled([
      collectNumbered<DeadlineChange>((params) =>
        axiosInstance.get(`${base}/deadline-history`, { params }),
      ),
      axiosInstance.get<{ items: { stage_id: string; title: string }[] }>(`${base}/stages`),
      isEvent ? getEventPlan(project.id) : Promise.resolve(undefined),
    ]).then(([changes, stages, plan]) => {
      if (!active) return
      if (changes.status === 'fulfilled') setHistory(changes.value)
      if (changes.status === 'rejected') setError(changes.reason.message)
      setTargets([
        { path: '', label: 'Общий срок' },
        ...(stages.status === 'fulfilled' ? stages.value.data.items : []).map((stage) => ({
          path: `/stages/${stage.stage_id}`,
          label: `Этап · ${stage.title}`,
        })),
        ...(plan.status === 'fulfilled' ? plan.value?.rounds || [] : [])
          .filter((round) => round.round_id)
          .map((round) => ({ path: `/rounds/${round.round_id}`, label: `Тур · ${round.title}` })),
      ])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [base, project.kind])
  const targetLabel = (change: DeadlineChange) => {
    const path = change.round_id
      ? `/rounds/${change.round_id}`
      : change.stage_id
        ? `/stages/${change.stage_id}`
        : ''
    return targets.find((item) => item.path === path)?.label || (change.round_id ? 'Тур' : 'Этап')
  }
  return (
    <section className="deadline-panel">
      <header>
        <h2>Сроки и история изменений</h2>
        <p>Выберите контрольную точку, тур или общий срок проекта.</p>
      </header>
      {editable && (
        <form
          className="deadline-panel__form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!deadline || !reason.trim() || busy) return
            setBusy(true)
            setError('')
            setMessage('')
            try {
              await axiosInstance.patch(`${base}${target}/deadline`, {
                due_at: new Date(deadline).toISOString(),
                reason: reason.trim(),
              })
              setMessage('Срок обновлён.')
              setDeadline('')
              setReason('')
              setHistory(
                await collectNumbered<DeadlineChange>((params) =>
                  axiosInstance.get(`${base}/deadline-history`, { params }),
                ),
              )
              await onSaved()
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <fieldset className="deadline-panel__fields" disabled={busy || loading}>
            <label>
              Срок для
              <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
                {targets.map((item) => (
                  <option key={item.path} value={item.path}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Новая дата и время
              <input
                type="datetime-local"
                className="input"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <label>
              Причина переноса
              <textarea
                className="textarea"
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" disabled={!reason.trim()}>
              Перенести срок
            </button>
          </fieldset>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загрузка истории…</p>
      ) : (
        <ReportTableView
          label="История сроков"
          headers={['Срок', 'Было', 'Стало', 'Причина', 'Изменено']}
          rows={history.map((item) => ({
            id: item.change_id,
            cells: [
              targetLabel(item),
              dateLabel(item.previous_due_at),
              dateLabel(item.due_at),
              item.reason,
              dateLabel(item.changed_at),
            ],
          }))}
          emptyText="Сроки ещё не переносили."
        />
      )}
    </section>
  )
}
