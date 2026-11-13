import { useEffect, useState } from 'react'
import { Building2, Calendar, Users } from 'lucide-react'
import { useAppSelector } from '../store'
import { opportunityApi } from '../api/opportunities'
import { apiRuntime } from '../api/runtime'
import { formatDate } from '../utils/date'
import { matchesSearch } from '../utils/publication'
import type { Opportunity } from './modals/OpportunityPublicationModal'
import { OpportunityDescription } from './OpportunityDescription'
import { PaginatedGrid } from './PaginatedGrid'
import { CatalogSearch } from './CatalogSearch'
import { Modal } from './Modal'

const labels: Record<string, string> = {
  moderation: 'На модерации',
  published: 'Опубликовано',
  closed: 'Приём завершён',
  revision: 'На доработке',
  hidden: 'Заблокировано',
}

export function InternshipModeration() {
  const admin = useAppSelector((state) => state.auth.currentUser?.role === 'admin')
  const [items, setItems] = useState<Opportunity[]>([])
  const [selected, setSelected] = useState<Opportunity>()
  const [comment, setComment] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('moderation')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const visible = items.filter(
    (item) =>
      (status === 'all' || item.status === status) &&
      matchesSearch(search, item.title, item.company_name, item.summary),
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      opportunityApi.list('moderation'),
      admin && apiRuntime.mode === 'live' ? opportunityApi.list('public') : Promise.resolve([]),
    ])
      .then(([pending, published]) => {
        if (active) {
          setItems([
            ...new Map([...published, ...pending].map((row) => [row.program_id, row])).values(),
          ])
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [admin])

  const close = () => {
    setSelected(undefined)
    setError('')
  }
  const review = async (decision: 'published' | 'revision' | 'hidden') => {
    if (!selected || busy || (decision !== 'published' && !comment.trim())) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await opportunityApi.setStatus(selected.program_id, decision, comment.trim())
      setItems((rows) =>
        admin
          ? rows.map((row) => (row.program_id === data.program_id ? data : row))
          : rows.filter((row) => row.program_id !== data.program_id),
      )
      close()
      setMessage(
        {
          published: 'Публикация одобрена.',
          revision: 'Публикация возвращена на доработку.',
          hidden: 'Публикация заблокирована и скрыта с витрины.',
        }[decision],
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="opportunity-review">
      <header className="home-section__header">
        <div>
          <h2>Модерация стажировок и практик</h2>
          <p>Рассматривайте описания и условия участия.</p>
        </div>
      </header>
      <div className="opportunity-filters">
        <CatalogSearch
          value={search}
          onChange={setSearch}
          label="Поиск по программе или компании"
        />
        {admin && (
          <label className="catalog-sort">
            Статус
            <select
              className="select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Все публикации</option>
              {['moderation', 'published', 'closed', 'hidden']
                .filter(
                  (value) => value !== 'hidden' || items.some((item) => item.status === 'hidden'),
                )
                .map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {message && (
        <p className="inline-notice" role="status">
          {message}
        </p>
      )}
      {!selected && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загрузка публикаций…</p>
      ) : !visible.length ? (
        <p className="card empty-state">По выбранным условиям публикаций нет.</p>
      ) : (
        <PaginatedGrid key={JSON.stringify([status, search])} paginationKey="opportunityReview">
          {visible.map((item) => (
            <article key={item.program_id} className="case-card opportunity-card">
              <div className="case-card__top-accent" />
              <div className="card__body">
                <div className="case-card__tags">
                  <span className="badge badge-direction">
                    {item.kind === 'practice' ? 'Практика' : 'Стажировка'}
                  </span>
                  <span className="badge badge-status">{labels[item.status]}</span>
                </div>
                <h3 className="case-card__title">{item.title}</h3>
                <div className="case-card__company">
                  <Building2 size={16} /> {item.company_name}
                </div>
                <p className="case-card__desc">{item.summary}</p>
                <div className="case-card__meta-grid opportunity-meta">
                  {item.capacity != null && (
                    <span>
                      <Users size={15} /> Мест: {item.capacity}
                    </span>
                  )}
                  {item.application_deadline && (
                    <span>
                      <Calendar size={15} /> До {formatDate(item.application_deadline)}
                    </span>
                  )}
                </div>
              </div>
              <div className="case-card__footer-bar">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setSelected(item)
                    setComment('')
                    setError('')
                  }}
                >
                  {item.status === 'moderation' ? 'Рассмотреть' : 'Открыть публикацию'}
                </button>
              </div>
            </article>
          ))}
        </PaginatedGrid>
      )}
      {selected && (
        <Modal title={selected.title} className="modal-dialog--lg" onClose={close} busy={busy}>
          <div className="modal-dialog__body opportunity-review-detail">
            <div className="action-row">
              <span className="badge badge-direction">
                {selected.kind === 'practice' ? 'Практика' : 'Стажировка'}
              </span>
              <span className="badge badge-status">{labels[selected.status]}</span>
            </div>
            <p>
              <strong>{selected.company_name}</strong>
            </p>
            <OpportunityDescription
              summary={selected.summary}
              markdown={selected.content_markdown}
            />
            {selected.moderation_comment && (
              <p className="inline-notice">Комментарий: {selected.moderation_comment}</p>
            )}
            {(selected.status === 'moderation' ||
              (admin &&
                (selected.status === 'published' ||
                  (apiRuntime.mode !== 'live' && selected.status === 'closed')))) && (
              <label>
                {selected.status === 'moderation' ? 'Комментарий модератора' : 'Причина блокировки'}
                <textarea
                  className="textarea"
                  disabled={busy}
                  maxLength={4000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-dialog__footer">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>
              Закрыть
            </button>
            {selected.status === 'moderation' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || !comment.trim()}
                  onClick={() => void review('revision')}
                >
                  На доработку
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void review('published')}
                >
                  Опубликовать
                </button>
              </>
            )}
            {admin &&
              (selected.status === 'published' ||
                (apiRuntime.mode !== 'live' && selected.status === 'closed')) && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy || !comment.trim()}
                  onClick={() => void review('hidden')}
                >
                  Заблокировать
                </button>
              )}
          </div>
        </Modal>
      )}
    </section>
  )
}
