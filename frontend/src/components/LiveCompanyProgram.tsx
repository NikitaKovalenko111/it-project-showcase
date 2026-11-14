import { ExpandableText } from './ExpandableText'
import { ReportButton } from './ReportButton'
import { OpportunityReviewActions, OpportunityBlockButton } from './OpportunityReviewActions'
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
  const reviewer = ['admin', 'curator', 'university'].includes(user?.role || '')
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
      reviewer && programId
        ? Promise.all([opportunityApi.list('public'), opportunityApi.list('moderation')]).then(
            (lists) => [...new Map(lists.flat().map((item) => [item.program_id, item])).values()],
          )
        : opportunityApi.list(ownCatalog ? 'mine' : 'public'),
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
  }, [ownCatalog, student, user?.id, reviewer, programId])

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
    <div className="program-page">
      {!programId && (
        <div className="page-header">
          <div className="page-header__content">{!programId && <h1>Стажировки и практики</h1>}</div>
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
      )}
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
          <div className="program-detail-toolbar">
            <Link
              className="btn btn-secondary btn-sm"
              to={params.get('review') ? '/companies?review=opportunities' : '?' + catalogUrl}
            >
              <ArrowLeft size={18} />{' '}
              {params.get('review') ? 'К модерации публикаций' : 'К витрине'}
            </Link>
            <div className="action-row">
              {selected && (
                <OpportunityBlockButton
                  program={selected}
                  onChanged={(item) =>
                    setPrograms((rows) =>
                      rows.map((row) => (row.program_id === item.program_id ? item : row)),
                    )
                  }
                />
              )}
              {selected &&
                !(company && user?.companyProfile?.companyId === selected.company_id) && (
                  <ReportButton targetType="internship" targetId={selected.program_id} />
                )}
            </div>
          </div>
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
                    {ownCatalog && selected.status === 'moderation' && (
                      <button
                        className="btn btn-secondary"
                        onClick={async () => {
                          try {
                            const item = await opportunityApi.setStatus(
                              selected.program_id,
                              'draft',
                              '',
                            )
                            setPrograms((rows) =>
                              rows.map((row) => (row.program_id === item.program_id ? item : row)),
                            )
                          } catch (cause) {
                            setError((cause as Error).message)
                          }
                        }}
                      >
                        Отозвать с модерации
                      </button>
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
                          onClick={() => {
                            setShowApplications((show) => !show)
                            setTimeout(
                              () =>
                                document
                                  .getElementById('program-applications')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                              0,
                            )
                          }}
                        >
                          {showApplications ? 'Скрыть заявки' : 'Заявки студентов'}
                        </button>
                      )}
                  </div>
                </aside>
              </div>
              {reviewer && selected.status === 'moderation' && (
                <OpportunityReviewActions
                  program={selected}
                  onChanged={(item) =>
                    setPrograms((rows) =>
                      rows.map((row) => (row.program_id === item.program_id ? item : row)),
                    )
                  }
                />
              )}
              {showApplications && ownCatalog && (
                <section className="opportunity-applications" id="program-applications">
                  <h3>Заявки студентов</h3>
                  <InternshipApplications
                    key={selected.program_id}
                    programId={selected.program_id}
                  />
                </section>
              )}
            </article>
          ) : (
            !error && <p className="empty-state card">Объявление недоступно.</p>
          )}
        </>
      ) : (
        <>
          <div className="uust-container program-catalog">
            <div
              className="uust-tabs-row mobile-wrap-tabs"
              role="tablist"
              aria-label="Тип программы"
            >
              <button
                type="button"
                role="tab"
                aria-selected={kind === 'internship'}
                className={'uust-tab ' + (kind === 'internship' ? 'active' : '')}
                onClick={() => choose('kind', 'internship')}
              >
                <Briefcase size={15} /> Стажировки
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={kind === 'practice'}
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
                  <ExpandableText compact text={item.summary} />
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
    </div>
  )
}
