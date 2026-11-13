import { opportunityApi } from '../api/opportunities'
import { apiRuntime } from '../api/runtime'
import { apiClient } from '../api/client'
import { OpportunityDescription } from './OpportunityDescription'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  GraduationCap,
  Plus,
  Users,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { axiosInstance } from '../api/http'
import { collectPages, fromCompany } from '../api/backend'
import type { Company } from '../types/models'
import { useAppSelector } from '../store'
import { InternshipApplications, InternshipApply } from './InternshipApplications'
import { formatDate } from '../utils/date'
import { matchesSearch } from '../utils/publication'
import { CatalogSearch } from './CatalogSearch'
import { PaginatedGrid } from './PaginatedGrid'
import {
  OpportunityPublicationModal,
  type Opportunity,
  type OpportunityKind,
} from './modals/OpportunityPublicationModal'

const stateLabels: Record<string, string> = {
  published: 'Открыт приём',
  moderation: 'На модерации',
  revision: 'На доработке',
  draft: 'Черновик',
  closed: 'Приём закрыт',
  hidden: 'Скрыта',
}

const names = { internship: 'Стажировка', practice: 'Практика' }
const plural = { internship: 'Стажировки', practice: 'Практики' }

export function LiveCompanyProgram() {
  const user = useAppSelector((state) => state.auth.currentUser)
  const company = user?.role === 'company'
  const student = user?.role === 'student'
  const [params, setParams] = useSearchParams()
  const kind: OpportunityKind = params.get('kind') === 'practice' ? 'practice' : 'internship'
  const companyId = params.get('company')
  const programId = params.get('program')
  const ownCatalog = company && params.get('scope') !== 'all'
  const [companies, setCompanies] = useState<Company[]>([])
  const [programs, setPrograms] = useState<Opportunity[]>([])
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Partial<Opportunity> & { kind: OpportunityKind }>()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showApplications, setShowApplications] = useState(false)

  useEffect(() => {
    if (!company) return
    let active = true
    const ownedCompanies =
      apiRuntime.mode === 'live'
        ? collectPages<any>((params) => axiosInstance.get('/companies/mine', { params })).then(
            (rows) => rows.map(fromCompany),
          )
        : apiClient
            .getCompanies()
            .then((rows) => rows.filter((item) => item.id === user?.companyProfile?.companyId))
    ownedCompanies
      .then((rows) => {
        if (active) setCompanies(rows)
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
    return () => {
      active = false
    }
  }, [company, user?.id])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      opportunityApi.list(ownCatalog ? 'mine' : 'public'),
      student ? opportunityApi.listApplications() : Promise.resolve([]),
    ])
      .then(([items, applications]) => {
        if (!active) return
        setPrograms(items)
        setApplied(
          new Set(
            applications
              .filter((item) => !['withdrawn', 'rejected'].includes(item.status))
              .map((item) => item.program_id),
          ),
        )
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [ownCatalog, student, user?.id])

  useEffect(() => {
    setShowApplications(false)
  }, [programId])

  const choose = (field: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(field, value)
    next.delete('program')
    next.delete('page')
    setSearch('')
    setParams(next)
  }
  const catalogUrl = new URLSearchParams(params)
  catalogUrl.delete('program')
  const detailsUrl = (item: Opportunity) => {
    const next = new URLSearchParams(catalogUrl)
    next.set('program', item.program_id)
    return '?' + next
  }
  const selected = programs.find((item) => item.program_id === programId)
  const visible = programs.filter(
    (item) =>
      item.kind === kind &&
      (!companyId || item.company_id === companyId) &&
      matchesSearch(search, item.title, item.summary, item.company_name),
  )
  const preferredCompany =
    companies.find((item) => item.id === companyId) ||
    companies.find((item) => item.id === user?.companyProfile?.companyId) ||
    companies[0]

  const meta = (item: Opportunity) => (
    <div className="case-card__meta-grid opportunity-meta">
      {item.capacity !== null && (
        <span>
          <Users size={15} /> Мест: {item.capacity}
        </span>
      )}
      {item.application_deadline && (
        <span>
          <CalendarDays size={15} /> До {formatDate(item.application_deadline)}
        </span>
      )}
    </div>
  )
  const open = (item: Opportunity) =>
    item.status === 'published' &&
    (!item.application_deadline || Date.parse(item.application_deadline) > Date.now())

  return (
    <>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Стажировки и практики</h1>
          <p>
            {ownCatalog
              ? 'Публикуйте программы и рассматривайте отклики студентов.'
              : 'Найдите программу компании и подайте заявку на участие.'}
          </p>
        </div>
        {ownCatalog && !programId && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!preferredCompany}
            onClick={() => {
              setNotice('')
              setEditor({ kind, company_id: preferredCompany?.id })
            }}
          >
            <Plus size={16} />{' '}
            {kind === 'practice' ? 'Разместить практику' : 'Разместить стажировку'}
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="opportunity-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Загружаем витрину…</p>
      ) : programId ? (
        <>
          <Link className="btn btn-secondary" to={'?' + catalogUrl}>
            <ArrowLeft size={16} /> К витрине
          </Link>
          {selected ? (
            <article className="opportunity-detail">
              <header className="opportunity-hero">
                <div className="opportunity-hero__badge">
                  {selected.kind === 'practice' ? (
                    <GraduationCap size={17} />
                  ) : (
                    <Briefcase size={17} />
                  )}
                  {names[selected.kind]}
                </div>
                <h2>{selected.title}</h2>
                <Link to={'/company/' + selected.company_id}>
                  <Building2 size={17} /> {selected.company_name}
                </Link>
              </header>
              <div className="opportunity-detail__layout">
                <section className="card opportunity-content">
                  <h3>О программе</h3>
                  <OpportunityDescription
                    summary={selected.summary}
                    markdown={selected.content_markdown}
                  />
                  {ownCatalog && selected.moderation_comment && (
                    <p className="inline-notice">
                      Комментарий модератора: {selected.moderation_comment}
                    </p>
                  )}
                </section>
                <aside className="card opportunity-enrollment">
                  <div>
                    <span
                      className={`badge ${open(selected) ? 'status-completed' : 'badge-direction'}`}
                    >
                      {open(selected)
                        ? stateLabels.published
                        : selected.status === 'published'
                          ? stateLabels.closed
                          : stateLabels[selected.status]}
                    </span>
                    <h3>Участие</h3>
                    {meta(selected)}
                  </div>
                  <div className="action-row">
                    {student && applied.has(selected.program_id) && (
                      <Link className="btn btn-secondary" to="/favorites?tab=internships">
                        Заявка подана · Мои заявки
                      </Link>
                    )}
                    {student && open(selected) && !applied.has(selected.program_id) && (
                      <InternshipApply
                        key={selected.program_id}
                        programId={selected.program_id}
                        title={selected.title}
                        kind={selected.kind}
                        onApplied={() => {
                          setApplied((items) => new Set([...items, selected.program_id]))
                          setNotice('Заявка отправлена.')
                        }}
                      />
                    )}
                    {ownCatalog && ['published', 'revision', 'draft'].includes(selected.status) && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditor(selected)}
                      >
                        Редактировать
                      </button>
                    )}
                    {ownCatalog &&
                      ['published', 'closed', 'revision', 'moderation', 'hidden'].includes(
                        selected.status,
                      ) && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-expanded={showApplications}
                          onClick={() => setShowApplications((show) => !show)}
                        >
                          Заявки студентов
                        </button>
                      )}
                  </div>
                </aside>
              </div>
              {showApplications && ownCatalog && (
                <InternshipApplications key={selected.program_id} programId={selected.program_id} />
              )}
            </article>
          ) : (
            !error && <p className="empty-state card">Объявление недоступно.</p>
          )}
        </>
      ) : (
        <>
          <div className="uust-container">
            <div className="uust-tabs-row mobile-wrap-tabs">
              <button
                type="button"
                className={'uust-tab ' + (kind === 'internship' ? 'active' : '')}
                onClick={() => choose('kind', 'internship')}
              >
                <Briefcase size={15} /> Стажировки
              </button>
              <button
                type="button"
                className={'uust-tab ' + (kind === 'practice' ? 'active' : '')}
                onClick={() => choose('kind', 'practice')}
              >
                <GraduationCap size={15} /> Практики
              </button>
            </div>
            <div className="uust-box">
              <div className="opportunity-filters">
                <CatalogSearch
                  value={search}
                  onChange={setSearch}
                  label="Поиск по названию, компании или условиям"
                />
                {company && (
                  <label className="catalog-sort">
                    Показывать
                    <select
                      className="uust-select"
                      value={ownCatalog ? 'mine' : 'all'}
                      onChange={(event) => choose('scope', event.target.value)}
                    >
                      <option value="mine">Мои публикации</option>
                      <option value="all">Вся витрина</option>
                    </select>
                  </label>
                )}
                {companyId && (
                  <Link
                    to={'/internships?kind=' + kind + (ownCatalog ? '&scope=mine' : '&scope=all')}
                  >
                    Все компании
                  </Link>
                )}
              </div>
            </div>
          </div>
          <p aria-live="polite">
            {plural[kind]} · {visible.length}
          </p>
          {!visible.length && !error && (
            <div className="card empty-state">По выбранным условиям публикаций пока нет.</div>
          )}
          <PaginatedGrid key={kind} className="case-grid opportunity-grid">
            {visible.map((item) => (
              <article
                className={`case-card opportunity-card opportunity-card--${item.kind}`}
                key={item.program_id}
              >
                <div className="case-card__top-accent" />
                <div className="card__body">
                  <div className="case-card__company">
                    <Building2 size={17} /> {item.company_name}
                  </div>
                  <h2 className="case-card__title">
                    <Link to={detailsUrl(item)}>{item.title}</Link>
                  </h2>
                  <p className="case-card__desc">{item.summary}</p>
                  <div className="case-card__tags">
                    <span className="badge badge-direction">{names[item.kind]}</span>
                    <span className="badge badge-status">
                      {open(item)
                        ? stateLabels.published
                        : item.status === 'published'
                          ? stateLabels.closed
                          : stateLabels[item.status]}
                    </span>
                  </div>
                  {meta(item)}
                </div>
                <div className="case-card__footer-bar">
                  <Link to={detailsUrl(item)} className="btn btn-primary btn-sm">
                    Подробнее
                  </Link>
                </div>
              </article>
            ))}
          </PaginatedGrid>
        </>
      )}
      {editor && (
        <OpportunityPublicationModal
          initial={editor}
          companies={companies}
          onClose={() => setEditor(undefined)}
          onSaved={(item, submitted) => {
            setPrograms((items) => [
              item,
              ...items.filter((old) => old.program_id !== item.program_id),
            ])
            setNotice(submitted ? 'Публикация отправлена на модерацию.' : 'Черновик сохранён.')
            setEditor(undefined)
          }}
        />
      )}
    </>
  )
}
