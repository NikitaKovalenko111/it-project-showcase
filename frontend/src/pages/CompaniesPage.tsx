import { ExpandableText } from '../components/ExpandableText'
import { IdentityImage } from '../components/IdentityImage'
import { PaginatedGrid } from '../components/PaginatedGrid'
import { CatalogSearch } from '../components/CatalogSearch'
import { PublicationReviewQueue } from '../components/PublicationReviewQueue'
import { InternshipModeration } from '../components/InternshipModeration'
import { canModerate, matchesSearch } from '../utils/publication'
import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store'
import { fetchCompaniesRequest } from '../store/actions'
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

export const CompaniesPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { casesList } = useAppSelector((state) => state.cases)
  const { companiesList, loading } = useAppSelector((state) => state.companies)

  const { currentUser } = useAppSelector((state) => state.auth)
  const [search, setSearch] = useState('')
  const [query] = useSearchParams()
  const [section, setSection] = useState<'companies' | 'cases' | 'opportunities'>(
    canModerate(currentUser) && query.get('review') === 'cases'
      ? 'cases'
      : canModerate(currentUser) && query.get('review') === 'opportunities'
        ? 'opportunities'
        : 'companies',
  )
  const filteredCompanies = companiesList.filter((company) =>
    matchesSearch(search, company.name, company.shortName, company.industry, company.techStack),
  )

  useEffect(() => {
    dispatch(fetchCompaniesRequest())
  }, [dispatch])

  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Компании-партнёры</h1>
        </div>
      </div>

      {canModerate(currentUser) && (
        <div className="tabs-bar mobile-wrap-tabs">
          <button
            className={`tab-btn ${section === 'companies' ? 'active' : ''}`}
            onClick={() => setSection('companies')}
          >
            Смотреть компании
          </button>
          <button
            className={`tab-btn ${section === 'cases' ? 'active' : ''}`}
            onClick={() => setSection('cases')}
          >
            Заявки на публикацию кейсов
          </button>
          <button
            className={`tab-btn ${section === 'opportunities' ? 'active' : ''}`}
            onClick={() => setSection('opportunities')}
          >
            Публикации стажировок и практик
          </button>
        </div>
      )}
      {section === 'cases' ? (
        <PublicationReviewQueue kind="case" />
      ) : section === 'opportunities' ? (
        <InternshipModeration />
      ) : (
        <>
          <CatalogSearch value={search} onChange={setSearch} label="Компания или технология" />
          {!loading && <p aria-live="polite">Найдено компаний: {filteredCompanies.length}</p>}
          {!loading && !filteredCompanies.length && (
            <div className="card empty-state">Компании не найдены.</div>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ui-muted)' }}>
              Загрузка компаний...
            </div>
          ) : (
            <PaginatedGrid>
              {filteredCompanies.map((comp) => (
                <div key={comp.id} className="case-card">
                  <div className="case-card__top-accent" />
                  <div className="card__body">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        marginBottom: '14px',
                      }}
                    >
                      <IdentityImage
                        src={comp.logo}
                        name={comp.shortName || comp.name}
                        className="company-card__logo"
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link to={`/company/${comp.id}`}>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '16px',
                                color: 'var(--ui-ink)',
                                fontWeight: 800,
                              }}
                            >
                              {comp.shortName}
                            </h3>
                          </Link>
                          {comp.isVerified && (
                            <span title="Верифицировано">
                              <ShieldCheck size={16} color="var(--ui-success-accent)" />
                            </span>
                          )}
                        </div>
                        <span
                          style={{ fontSize: '11px', color: 'var(--ui-muted)', fontWeight: 600 }}
                        >
                          {comp.industry}
                        </span>
                      </div>
                    </div>

                    <ExpandableText compact text={comp.description} />

                    <div
                      className="responsive-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        background: 'var(--ui-panel)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        marginBottom: '14px',
                        border: '1px solid var(--ui-soft)',
                      }}
                    >
                      <div>
                        Активных кейсов:{' '}
                        <strong style={{ color: 'var(--ui-ink)' }}>
                          {
                            casesList.filter(
                              (item) =>
                                item.companyId === comp.id &&
                                item.isModerated &&
                                ['open', 'in_progress'].includes(item.status),
                            ).length
                          }
                        </strong>
                      </div>
                      <div>
                        Завершено проектов:{' '}
                        <strong style={{ color: 'var(--ui-ink)' }}>
                          {
                            casesList.filter(
                              (item) =>
                                item.companyId === comp.id &&
                                item.isModerated &&
                                item.status === 'completed',
                            ).length
                          }
                        </strong>
                      </div>
                    </div>

                    {/* Tech stack */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {comp.techStack.map((t) => (
                        <span
                          key={t}
                          style={{
                            background: 'var(--ui-soft)',
                            color: 'var(--ui-body)',
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="case-card__footer-bar company-directory-footer">
                    <a
                      href={comp.website}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        color: 'var(--ui-brand-text)',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <Globe size={13} /> {comp.website.replace('https://', '')}
                    </a>

                    <Link to={`/company/${comp.id}`} className="btn btn-primary btn-sm">
                      Карточка компании →
                    </Link>
                  </div>
                </div>
              ))}
            </PaginatedGrid>
          )}
        </>
      )}
    </div>
  )
}
