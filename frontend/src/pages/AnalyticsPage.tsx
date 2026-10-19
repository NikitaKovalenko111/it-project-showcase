import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { visibleCasesFor } from '../utils/access'
import { useAppSelector } from '../store'
import {
  Award,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  PieChart,
  Printer,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'

export const AnalyticsPage: React.FC = () => {
  const { casesList: allCases } = useAppSelector((state) => state.cases)
  const { companiesList: allCompanies } = useAppSelector((state) => state.companies)
  const { studentsList } = useAppSelector((state) => state.students)
  const { applicationsList: allApplications } = useAppSelector((state) => state.applications)

  const { currentUser } = useAppSelector((state) => state.auth)
  const academicYear = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
  const [period, setPeriod] = useState('all')
  const [selectedDirection, setSelectedDirection] = useState('all')
  const scopedCases = visibleCasesFor(currentUser, allCases)
  const casesList = scopedCases.filter((project) => {
    const year = Number(period)
    return (period === 'all' || (project.publishedAt >= `${year}-09-01` && project.publishedAt < `${year + 1}-09-01`))
      && (selectedDirection === 'all' || project.direction === selectedDirection)
  })
  const caseIds = new Set(casesList.map((project) => project.id))
  const applicationsList = allApplications.filter((app) => caseIds.has(app.caseId)
    && (currentUser?.role !== 'company' || app.companyId === currentUser.companyProfile?.companyId))
  const companiesList = currentUser?.role === 'company'
    ? allCompanies.filter((company) => company.id === currentUser.companyProfile?.companyId) : allCompanies

  // Metrics computation strictly based on section 5.21
  const totalCompanies = companiesList.length
  const activeCompanies = companiesList.filter((company) => casesList.some((project) => project.companyId === company.id && project.status === 'open')).length
  const totalCases = casesList.length
  const completedCases = casesList.filter((c) => c.status === 'completed').length
  const inProgressCases = casesList.filter((c) => c.status === 'in_progress').length
  const openCases = casesList.filter((c) => c.status === 'open').length

  const totalStudents = studentsList.length
  const totalApplications = applicationsList.length
  const acceptedApplications = applicationsList.filter((a) => a.status === 'accepted').length

  const contestCases = casesList.filter((c) => c.rewardType === 'contest')
  const monetaryCases = casesList.filter((c) => c.rewardType === 'monetary')
  const educationalCases = casesList.filter((c) => c.rewardType === 'educational')

  const totalPrizeFund = contestCases.reduce((sum, c) => sum + (c.prizeFund || 0), 0)
  const totalMonetary = monetaryCases.reduce((sum, c) => sum + (c.rewardAmount || 0), 0)

  // Top directions
  const directionsData = [...new Set(casesList.map((project) => project.direction))].map((name) => {
    const projects = casesList.filter((project) => project.direction === name)
    const ids = new Set(projects.map((project) => project.id))
    const applicants = applicationsList.filter((app) => ids.has(app.caseId)).length
    return { name, cases: projects.length, applicants, demand: totalApplications ? `${Math.round(applicants / totalApplications * 100)}%` : '0%' }
  })


  // Export to Excel (п. 5.21 ТЗ)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()

    const summaryData = [
      ['Отчёт по проектной деятельности АИС «Витрина ИТ-проектов» УУНиТ', ''],
      ['Отчётный период:', period],
      ['Дата формирования:', new Date().toLocaleDateString('ru-RU')],
      [],
      ['Показатель', 'Значение'],
      ['Зарегистрировано компаний-партнеров', totalCompanies],
      ['Активных компаний с открытыми кейсами', activeCompanies],
      ['Всего размещено ИТ-кейсов', totalCases],
      ['Кейсов в стадии выполнения', inProgressCases],
      ['Успешно завершено кейсов', completedCases],
      ['Подано заявок от студентов', totalApplications],
      ['Одобрено заявок (участников проектов)', acceptedApplications],
      ['Конкурсных проектов', contestCases.length],
      ['Суммарный призовой фонд (руб.)', totalPrizeFund],
      ['Суммарный фонд денежных вознаграждений (руб.)', totalMonetary],
    ]

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Общая статистика')

    const casesSheetData = casesList.map((c) => ({
      ID: c.id,
      Название: c.title,
      Компания: c.companyName,
      Направление: c.direction,
      Сложность: c.complexity,
      Тип: c.rewardType,
      'Призовой фонд (руб)': c.prizeFund || c.rewardAmount || 0,
      Статус: c.status,
      'Подано заявок': c.applicationsCount,
    }))
    const wsCases = XLSX.utils.json_to_sheet(casesSheetData)
    XLSX.utils.book_append_sheet(wb, wsCases, 'Реестр кейсов')

    XLSX.writeFile(wb, `UUST_IT_Showcase_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Export to CSV (п. 5.21 ТЗ)
  const handleExportCSV = () => {
    const headers = 'ID;Название;Компания;Направление;Сложность;Тип;ПризовойФонд;Статус\n'
    const rows = casesList
      .map(
        (c) =>
          `"${c.id}";"${c.title}";"${c.companyName}";"${c.direction}";"${c.complexity}";"${c.rewardType}";${
            c.prizeFund || c.rewardAmount || 0
          };"${c.status}"`
      )
      .join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `UUST_Analytics_Export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Export to PDF / Print (п. 5.21 ТЗ)
  const handleExportPDF = () => {
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('UUST IT-Project Showcase: Analytics Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Period: ${period} | Date: ${new Date().toLocaleDateString('ru-RU')}`, 14, 28)

    const tableData = [
      ['Total Partner Companies', String(totalCompanies)],
      ['Active Partner Companies', String(activeCompanies)],
      ['Total Placed Cases', String(totalCases)],
      ['Cases in Progress', String(inProgressCases)],
      ['Completed Cases', String(completedCases)],
      ['Student Applications Submitted', String(totalApplications)],
      ['Approved Project Participants', String(acceptedApplications)],
      ['Total Prize Fund', `${totalPrizeFund.toLocaleString()} RUB`],
    ]

    autoTable(doc, {
      startY: 34,
      head: [['Metric', 'Value']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 43, 72] },
    })

    doc.save(`UUST_IT_Report_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__content">
          <h1>{currentUser?.role === 'company' ? 'Аналитика моих кейсов' : 'Аналитика проектного обучения'}</h1>
          <p>
            {currentUser?.role === 'company' ? 'Заявки, результаты и вознаграждения по кейсам вашей компании. Экспорт учитывает выбранные фильтры.' : 'Сводные показатели проектной деятельности УУНиТ по выбранному периоду и направлению.'}
          </p>
        </div>

        <div className="page-header__actions">
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} title="Экспорт в CSV (п. 5.21)">
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportExcel} title="Экспорт в Excel (п. 5.21)">
            <FileSpreadsheet size={14} color="#16805b" /> Экспорт в Excel (.xlsx)
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExportPDF} title="Экспорт в PDF (п. 5.21)">
            <Download size={14} /> Скачать PDF отчёт
          </button>
        </div>
      </div>

      {/* Filter / Period Row */}
      <div className="filter-bar" style={{ padding: '12px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={16} color="#1b5e91" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Отчётный период:</span>
            <select
              className="select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="all">За всё время</option>
              <option value={academicYear}>{academicYear}/{academicYear + 1} учебный год</option>
              <option value={academicYear - 1}>{academicYear - 1}/{academicYear} учебный год</option>
            </select>
          </div>

          <label>Направление: <select className="uust-select" value={selectedDirection} onChange={(e) => setSelectedDirection(e.target.value)}>
            <option value="all">Все направления</option>
            {[...new Set(scopedCases.map((project) => project.direction))].map((direction) => <option key={direction}>{direction}</option>)}
          </select></label>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Университет: <strong>УУНиТ • Межвузовский кампус Евразийского НОЦ</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card__icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <Building2 size={20} />
          </div>
          <div className="kpi-card__value">{totalCompanies}</div>
          <div className="kpi-card__label">Компаний-партнёров ({activeCompanies} активных)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Layers size={20} />
          </div>
          <div className="kpi-card__value">{totalCases}</div>
          <div className="kpi-card__label">Размещено кейсов ({inProgressCases} в работе)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Award size={20} />
          </div>
          <div className="kpi-card__value">{totalPrizeFund.toLocaleString('ru-RU')} ₽</div>
          <div className="kpi-card__label">Суммарный призовой фонд</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <Users size={20} />
          </div>
          <div className="kpi-card__value">{totalApplications}</div>
          <div className="kpi-card__label">Подано заявок студентами</div>
        </div>
      </div>

      {/* Main Analytics Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Section 1: Directions & Tech popularity (п. 5.21 ТЗ) */}
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Востребованность ИТ-направлений (п. 5.21 ТЗ)
            </h3>
            <span className="badge badge-direction">Топ технологий</span>
          </div>

          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Направление</th>
                    <th>Кейсов</th>
                    <th>Заявок</th>
                    <th>Доля заявок</th>
                  </tr>
                </thead>
                <tbody>
                  {directionsData.map((d, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td>{d.cases}</td>
                      <td>{d.applicants}</td>
                      <td>
                        <span style={{ color: '#16805b', fontWeight: 700 }}>{d.demand}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 2: Financial Conditions Breakdown (п. 5.4, 5.5, 5.21 ТЗ) */}
        <div className="card">
          <div className="card__header">
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Структура поощрений и фондов (п. 5.4, 5.21 ТЗ)
            </h3>
            <PieChart size={18} color="#1b5e91" />
          </div>

          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#92400e', display: 'block' }}>
                  Конкурсные кейсы ({contestCases.length} шт.)
                </strong>
                <span style={{ fontSize: '11px', color: '#78350f' }}>Определение 1, 2, 3 мест и наград</span>
              </div>
              <strong style={{ fontSize: '16px', color: '#92400e' }}>
                {totalPrizeFund.toLocaleString('ru-RU')} ₽
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#065f46', display: 'block' }}>
                  С прямой оплатой ({monetaryCases.length} шт.)
                </strong>
                <span style={{ fontSize: '11px', color: '#047857' }}>Выплаты по договорам ГПХ за MVP</span>
              </div>
              <strong style={{ fontSize: '16px', color: '#065f46' }}>
                {totalMonetary.toLocaleString('ru-RU')} ₽
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#1e40af', display: 'block' }}>
                  Образовательные кейсы ({educationalCases.length} шт.)
                </strong>
                <span style={{ fontSize: '11px', color: '#1d4ed8' }}>Сертификаты, отзывы, портфолио</span>
              </div>
              <span className="badge badge-verified">Без денежных выплат</span>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              * Согласно п. 5.5 ТЗ АИС не выступает платёжной системой; фактическая выплата осуществляется напрямую компанией.
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Companies Interaction Table (п. 5.21 ТЗ) */}
      <div className="card">
        <div className="card__header">
          <h3 style={{ margin: 0, fontSize: '15px' }}>
            Взаимодействие компаний с университетом (п. 5.21 ТЗ)
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Компании с наибольшим числом кейсов</span>
        </div>

        <div className="card__body" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Компания</th>
                  <th>Отрасль</th>
                  <th>Размещено кейсов</th>
                  <th>Завершено кейсов</th>
                  <th>Охват студентов</th>
                  <th>Статус аккредитации</th>
                </tr>
              </thead>
              <tbody>
                {companiesList.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={c.logo}
                          alt=""
                          style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                        />
                        <strong>{c.name}</strong>
                      </div>
                    </td>
                    <td>{c.industry}</td>
                    <td>{casesList.filter((project) => project.companyId === c.id).length}</td>
                    <td>{casesList.filter((project) => project.companyId === c.id && project.status === 'completed').length}</td>
                    <td>{new Set(applicationsList.filter((app) => app.companyId === c.id).map((app) => app.studentId)).size} чел.</td>
                    <td>
                      <span className="badge badge-direction">{c.isVerified ? '✓ Верифицирована' : 'На проверке'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
