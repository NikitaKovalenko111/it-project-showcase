import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  const { companiesList, loading } = useAppSelector((state) => state.companies)

  useEffect(() => {
    dispatch(fetchCompaniesRequest())
  }, [dispatch])

  return (
    <div>
      <div className="page-header">
        <div className="page-header__content">
          <h1>Компании-партнёры УУНиТ</h1>
          <p>
            Реестр индустриальных партнёров, высокотехнологичных предприятий и ИТ-компаний Евразийского НОЦ, размещающих проектные кейсы для студентов.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>Загрузка компаний...</div>
      ) : (
        <div className="case-grid">
          {companiesList.map((comp) => (
            <div key={comp.id} className="case-card">
              <div className="case-card__top-accent" />
              <div className="card__body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <img
                    src={comp.logo}
                    alt={comp.name}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '1px solid #dce4ed',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Link to={`/company/${comp.id}`}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0c1938', fontWeight: 800 }}>
                          {comp.shortName}
                        </h3>
                      </Link>
                      {comp.isVerified && (
                        <span title="Верифицировано УУНиТ">
                          <ShieldCheck size={16} color="#28a745" />
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#627282', fontWeight: 600 }}>{comp.industry}</span>
                  </div>
                </div>

                <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#334455', lineHeight: 1.55, minHeight: '56px' }}>
                  {comp.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '11px', marginBottom: '14px', border: '1px solid #eef2f6' }}>
                  <div>
                    Кейсов в семестре: <strong style={{ color: '#0c1938' }}>{comp.activeCasesCount}</strong>
                  </div>
                  <div>
                    Завершено проектов: <strong style={{ color: '#0c1938' }}>{comp.completedProjectsCount}</strong>
                  </div>
                </div>

                {/* Tech stack */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {comp.techStack.map((t) => (
                    <span
                      key={t}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
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

              <div className="case-card__footer-bar">
                <a
                  href={comp.website}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#3a75b4', fontWeight: 700, textDecoration: 'none' }}
                >
                  <Globe size={13} /> {comp.website.replace('https://', '')}
                </a>

                <Link to={`/company/${comp.id}`} className="btn btn-primary btn-sm">
                  Карточка компании →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
