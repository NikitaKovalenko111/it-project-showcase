import React, { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useAppSelector } from '../store'
import { apiClient } from '../api/client'
import type { ProjectEvaluation, ProjectMilestone } from '../types/models'
import { buildAnalyticsReport, type AnalyticsFilters, type ReportTable } from '../utils/analytics'
import { downloadCsvReport, downloadExcelReport, downloadPdfReport } from '../utils/exportReport'

export const AnalyticsPage: React.FC = () => {
  const { currentUser } = useAppSelector((state) => state.auth)
  const { casesList, loading: casesLoading } = useAppSelector((state) => state.cases)
  const { projectsList } = useAppSelector((state) => state.studentProjects)
  const { studentsList, teamsList } = useAppSelector((state) => state.students)
  const { applicationsList } = useAppSelector((state) => state.applications)
  const { companiesList } = useAppSelector((state) => state.companies)
  const companyView = currentUser?.role === 'company'
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: 'all', company: 'all', direction: 'all', institute: 'all', course: 'all', type: 'all' })
  const [details, setDetails] = useState<{ milestones: ProjectMilestone[]; evaluations: ProjectEvaluation[] }>({ milestones: [], evaluations: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const caseKey = casesList.map((project) => project.id).sort().join(',')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all(casesList.map(async (project) => {
      const [milestones, evaluation] = await Promise.all([apiClient.getMilestones(project.id), apiClient.getEvaluation(project.id).catch((cause) => {
        if (cause?.response?.status === 404) return undefined
        throw cause
      })])
      return { milestones, evaluation }
    })).then((records) => {
      if (!cancelled) setDetails({ milestones: records.flatMap((item) => item.milestones), evaluations: records.flatMap((item) => item.evaluation ? [item.evaluation] : []) })
    }).catch((cause) => { if (!cancelled) setError(cause.message || 'Не удалось загрузить данные для отчета') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [caseKey, currentUser?.id])
  const report = useMemo(() => buildAnalyticsReport({ user: currentUser, cases: casesList, projects: projectsList, companies: companiesList,
    students: studentsList, applications: applicationsList, teams: teamsList, ...details }, filters),
  [currentUser, casesList, projectsList, companiesList, studentsList, applicationsList, teamsList, details, filters])
  const setFilter = (key: keyof AnalyticsFilters, value: string) => setFilters((previous) => ({ ...previous, [key]: value }))
  const academicYear = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
  const title = companyView ? 'Аналитика моих кейсов' : 'Аналитика проектной деятельности'
  const periodLabel = filters.period === 'all' ? 'За все время' : `${filters.period}/${Number(filters.period) + 1} учебный год`
  const companyLabel = companyView ? currentUser?.companyProfile?.companyName : filters.company === 'all' ? 'Все компании' : companiesList.find((company) => company.id === filters.company)?.name
  const filterDescription = `${periodLabel}; ${companyLabel}; направление: ${filters.direction === 'all' ? 'все' : filters.direction}; институт: ${filters.institute === 'all' ? 'все' : filters.institute}; курс: ${filters.course === 'all' ? 'все' : filters.course}; тип: ${{ all: 'все', company: 'кейсы компаний', student: 'студенческие проекты' }[filters.type]}; сформирован ${new Date().toLocaleString('ru-RU')}`
  const exportTables: ReportTable[] = [{ title: 'Параметры отчета', headers: ['Параметр', 'Значение'], rows: [['Область', title], ['Фильтры и дата', filterDescription], ['Примечание', 'Интервью — текущий статус заявок; фонды — заявленные суммы; выплаты — только подтвержденные. История стажировок недоступна.']] }, ...report.tables]
  const exportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setExporting(true); setExportError('')
    try {
      const name = `it-projects-${companyView ? 'company' : 'curator'}-${new Date().toISOString().slice(0, 10)}`
      if (format === 'csv') downloadCsvReport(exportTables, name)
      else if (format === 'xlsx') await downloadExcelReport(exportTables, name)
      else await downloadPdfReport(exportTables, name, title, filterDescription)
    } catch (cause) { setExportError(cause instanceof Error ? cause.message : 'Не удалось выгрузить отчет') }
    finally { setExporting(false) }
  }
  const busy = loading || casesLoading || exporting
  const metrics = companyView
    ? [['Опубликовано кейсов', report.metrics.published], ['Получено заявок', report.metrics.applications], ['Назначено интервью', report.metrics.interviews], ['Завершено кейсов', report.metrics.completed]]
    : [['Участников кейсов', report.metrics.participants], ['Завершено кейсов', report.metrics.completed], ['Просрочено проектов', report.metrics.overdue], ['Публикаций на рассмотрении', report.metrics.pending]]
  return <div className="analytics-page">
    <div className="page-header"><div className="page-header__content"><h1>{title}</h1><p>{companyView ? 'Заявки, отбор, команды и результаты по кейсам вашей компании.' : 'Участие студентов, сроки, завершения, модерация и взаимодействие с компаниями.'}</p></div>
      <div className="page-header__actions">
        <button className="btn btn-secondary btn-sm" disabled={busy || !!error} onClick={() => exportReport('csv')}><FileSpreadsheet size={15} /> CSV</button>
        <button className="btn btn-secondary btn-sm" disabled={busy || !!error} onClick={() => exportReport('xlsx')}><FileSpreadsheet size={15} /> Excel</button>
        <button className="btn btn-primary btn-sm" disabled={busy || !!error} onClick={() => exportReport('pdf')}><Download size={15} /> PDF</button>
      </div>
    </div>
    <div className="analytics-filters card">
      <label>Период<select className="select" value={filters.period} onChange={(event) => setFilter('period', event.target.value)}><option value="all">За все время</option>{[academicYear, academicYear - 1, academicYear - 2].map((year) => <option value={year} key={year}>{year}/{year + 1} учебный год</option>)}</select></label>
      {!companyView && <label>Компания<select className="select" value={filters.company} onChange={(event) => setFilter('company', event.target.value)}><option value="all">Все компании</option>{companiesList.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>}
      <label>Направление<select className="select" value={filters.direction} onChange={(event) => setFilter('direction', event.target.value)}><option value="all">Все направления</option>{[...new Set([...casesList.map((project) => project.direction), ...(!companyView ? projectsList.map((project) => project.direction) : [])])].sort().map((direction) => <option key={direction}>{direction}</option>)}</select></label>
      <label>Институт<select className="select" value={filters.institute} onChange={(event) => setFilter('institute', event.target.value)}><option value="all">Все институты</option>{[...new Set(studentsList.map((student) => student.studentProfile?.institute).filter(Boolean))].map((institute) => <option key={institute}>{institute}</option>)}</select></label>
      <label>Курс<select className="select" value={filters.course} onChange={(event) => setFilter('course', event.target.value)}><option value="all">Все курсы</option>{[1, 2, 3, 4, 5, 6].map((course) => <option key={course} value={course}>{course}</option>)}</select></label>
      {!companyView && <label>Тип проекта<select className="select" value={filters.type} onChange={(event) => setFilter('type', event.target.value)}><option value="all">Все типы</option><option value="company">Кейсы компаний</option><option value="student">Студенческие проекты</option></select></label>}
      <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ period: 'all', company: 'all', direction: 'all', institute: 'all', course: 'all', type: 'all' })}>Сбросить фильтры</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {exportError && <p role="alert">{exportError}</p>}
    {loading || casesLoading ? <p role="status">Подготовка аналитики…</p> : <>
      <div className="kpi-grid">{metrics.map(([label, value]) => <div className="kpi-card" key={label}><div className="kpi-card__value">{value}</div><div className="kpi-card__label">{label}</div></div>)}</div>
      <p className="analytics-note">Период относится к дате публикации проекта. Курс и институт отбирают проекты по заявителям и участникам. Интервью учитываются по текущему статусу; фонды показывают заявленные суммы, а выплаты — только подтвержденные. История приглашений на стажировки пока недоступна.</p>
      {report.tables.map((table) => <section className="card analytics-table" key={table.title}>
        <div className="card__header"><h2>{table.title}</h2><span>{table.rows.length} записей</span></div>
        <div className="table-container"><table className="data-table"><thead><tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}{!table.rows.length && <tr><td colSpan={table.headers.length}>Нет данных для выбранных фильтров</td></tr>}</tbody>
        </table></div>
      </section>)}
    </>}
  </div>
}
