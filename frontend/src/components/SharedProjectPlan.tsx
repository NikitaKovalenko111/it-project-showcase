import { useConfirm } from './ConfirmProvider'
import React, { useEffect, useState } from 'react'
import { Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { apiRuntime } from '../api/runtime'
import { formatDate } from '../utils/date'
import { communityApi } from '../api/community'
import { CaseProject, ProjectMilestone } from '../types/models'
type Row = Pick<ProjectMilestone, 'id' | 'title' | 'description' | 'deadline'>
export const SharedProjectPlan: React.FC<{
  project: CaseProject
  editable: boolean
  onSaved: () => Promise<void>
  onOpenDeadlines?: () => void
}> = ({ project, editable, onSaved, onOpenDeadlines }) => {
  const confirm = useConfirm()
  const [rows, setRows] = useState<Row[]>([]),
    [baseline, setBaseline] = useState<Row[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [shift, setShift] = useState(1),
    [loading, setLoading] = useState(true)
  const loadPlan = async () => {
    const result = await communityApi.getSharedPlan(project.id)
    setRows(result)
    setBaseline(result)
  }
  useEffect(() => {
    let active = true
    setLoading(true)
    communityApi
      .getSharedPlan(project.id)
      .then((result) => {
        if (active) {
          setRows(result)
          setBaseline(result)
        }
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
  }, [project.id])
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const result = await communityApi.updateSharedPlan(project.id, rows, baseline)
      setRows(result)
      setBaseline(result)
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
      if (apiRuntime.mode === 'live') {
        try {
          await loadPlan()
        } catch {
          setError('Не удалось загрузить план после ошибки. Откройте вкладку заново.')
        }
      }
      return
    } finally {
      setBusy(false)
    }
    await onSaved().catch(() =>
      setError('План сохранён. Обновите страницу, чтобы загрузить список выполнений.'),
    )
  }
  const update = (index: number, patch: Partial<Row>) => {
    setSaved(false)
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const next = [...rs]
      ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
      return next
    })
  if (loading) return <p role="status">Загрузка этапов…</p>
  if (!editable)
    return (
      <section className="shared-plan readonly-plan">
        <h2>
          {project.kind === 'olympiad' && apiRuntime.mode !== 'live'
            ? 'Расписание туров'
            : 'Контрольные точки'}
        </h2>
        {error && <p role="alert">{error}</p>}
        <p>Организатор задаёт общие сроки и требования для всех участников.</p>
        {onOpenDeadlines && (
          <div className="action-row">
            <small>Названия, состав и порядок контрольных точек редактируются в черновике.</small>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenDeadlines}>
              Перенести сроки
            </button>
          </div>
        )}
        <div className="workspace-page__milestones">
          {rows.map((row, i) => (
            <article className="milestone-item" key={row.id}>
              <span className="step-number">{i + 1}</span>
              <div className="step-info">
                <h3 className="step-title">{row.title}</h3>
                <p className="step-desc preserve-text">{row.description}</p>
                <p className="step-deadline">Срок сдачи: {formatDate(row.deadline)}</p>
              </div>
            </article>
          ))}
        </div>
        {!rows.length && <p className="empty-state">План пока не заполнен.</p>}
      </section>
    )
  return (
    <section className="card shared-plan">
      <div className="feature-toolbar">
        <div>
          <h2>
            {project.kind === 'olympiad' && apiRuntime.mode !== 'live'
              ? 'Общее расписание туров'
              : 'Общий план реализации'}
          </h2>
          <p>
            Названия, порядок и сроки общие для всех. Файлы, прогресс и рецензии хранятся отдельно у
            каждой команды.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && <p role="status">План сохранён.</p>}
      <form onSubmit={save}>
        <fieldset disabled={!editable || busy || project.status === 'completed'}>
          <legend>Контрольные точки</legend>
          <div className="shared-plan-list">
            {rows.map((row, i) => (
              <article className="shared-plan-row" key={row.id}>
                <div className="feature-toolbar">
                  <strong>Этап {i + 1}</strong>
                  <div className="action-row">
                    <button
                      type="button"
                      className="icon-delete"
                      aria-label={`Поднять этап ${i + 1}`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-delete"
                      aria-label={`Опустить этап ${i + 1}`}
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-delete"
                      aria-label={`Удалить этап ${i + 1}`}
                      onClick={async () => {
                        if (
                          await confirm(
                            'Убрать этап из общего плана? Если по нему уже есть работа участников, сохранение будет отклонено.',
                          )
                        )
                          setRows((rs) => rs.filter((_, j) => j !== i))
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="shared-plan-fields">
                  <label>
                    Название
                    <input
                      className="input"
                      required
                      maxLength={150}
                      value={row.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                    />
                  </label>
                  <label>
                    Перенести срок
                    <input
                      className="input"
                      type="date"
                      required={apiRuntime.mode !== 'live'}
                      value={row.deadline}
                      onChange={(e) => update(i, { deadline: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Описание
                  <textarea
                    className="textarea"
                    maxLength={3000}
                    value={row.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                </label>
              </article>
            ))}
          </div>
          {!rows.length && (
            <p>План пока не заполнен. Добавьте этапы разработки, защиты или туры олимпиады.</p>
          )}
          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setRows((rs) => [
                  ...rs,
                  { id: `plan_${crypto.randomUUID()}`, title: '', description: '', deadline: '' },
                ])
              }
            >
              <Plus size={16} /> Добавить этап
            </button>
            <label className="plan-shift">
              Сдвиг сроков, дней
              <input
                className="input"
                type="number"
                step="1"
                min="-365"
                max="365"
                value={shift}
                onChange={(e) => setShift(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={
                !Number.isInteger(shift) ||
                Math.abs(shift) > 365 ||
                !shift ||
                !rows.some((row) => row.deadline)
              }
              onClick={() =>
                setRows((rs) =>
                  rs.map((r) => {
                    if (!r.deadline) return r
                    const d = new Date(`${r.deadline}T12:00:00Z`)
                    d.setUTCDate(d.getUTCDate() + shift)
                    return { ...r, deadline: d.toISOString().slice(0, 10) }
                  }),
                )
              }
            >
              Сдвинуть все сроки
            </button>
          </div>
          {editable && (
            <div className="action-row">
              <button className="btn btn-primary" disabled={busy}>
                Сохранить общий план
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setRows(baseline)
                  setError('')
                  setSaved(false)
                }}
              >
                Отменить изменения
              </button>
            </div>
          )}
        </fieldset>
      </form>
      {project.status === 'completed' && (
        <p>После публикации итогов план доступен только для чтения.</p>
      )}
    </section>
  )
}
