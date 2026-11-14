import { OpportunityReviewActions } from './OpportunityReviewActions'
import { ExpandableText } from './ExpandableText'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Building2, Calendar, Users } from 'lucide-react'
import { useAppSelector } from '../store'
import { opportunityApi } from '../api/opportunities'
import { apiRuntime } from '../api/runtime'
import { formatDate } from '../utils/date'
import { matchesSearch } from '../utils/publication'
import type { Opportunity } from './modals/OpportunityPublicationModal'
import { PaginatedGrid } from './PaginatedGrid'
import { CatalogSearch } from './CatalogSearch'

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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('moderation')
  const [loading, setLoading] = useState(true)
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

  return (
    <section className="opportunity-review">
      <header className="home-section__header">
        <div>
          <h2>Модерация стажировок и практик</h2>
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загрузка публикаций…</p>
      ) : !visible.length ? (
        <p className="card empty-state">По выбранным условиям публикаций нет.</p>
      ) : (
        <PaginatedGrid
          pageSize={6}
          className="review-list"
          key={JSON.stringify([status, search])}
          paginationKey="opportunityReview"
        >
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
                <ExpandableText compact text={item.summary} />
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
              <OpportunityReviewActions
                program={item}
                onChanged={(updated) =>
                  setItems((rows) =>
                    rows.map((row) => (row.program_id === updated.program_id ? updated : row)),
                  )
                }
              />
              <div className="case-card__footer-bar">
                <Link
                  className="btn btn-secondary btn-sm"
                  to={`/internships?scope=all&program=${item.program_id}&review=1`}
                >
                  Прочитать описание и условия
                </Link>
              </div>
            </article>
          ))}
        </PaginatedGrid>
      )}
    </section>
  )
}
