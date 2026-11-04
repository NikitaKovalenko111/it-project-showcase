import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './load-ts.mjs'

const { buildAnalyticsReport, reportToCsv } = await import(await loadTs(new URL('../src/utils/analytics.ts', import.meta.url)))
const filters = { period: 'all', company: 'all', direction: 'all', institute: 'all', course: 'all', type: 'all' }
const project = (id, extra = {}) => ({ id, title: id, companyId: 'own', companyName: 'Own company', direction: 'Frontend', publishedAt: '2026-10-01', deadlineDate: '2026-10-20', status: 'in_progress', isModerated: true, rewardType: 'educational', recommendedTech: ['React'], ...extra })
const data = (extra = {}) => ({ user: { id: 'curator', role: 'curator' }, cases: [], projects: [], companies: [], students: [], applications: [], teams: [], milestones: [], evaluations: [], ...extra })
const summary = (report, metric) => report.tables.find((table) => table.title === 'Сводка').rows.find(([name]) => name === metric)?.[1]

test('company reports never include another company or student projects', () => {
  const report = buildAnalyticsReport(data({
    user: { id: 'partner', role: 'company', companyProfile: { companyId: 'own' } },
    cases: [project('ours'), project('other', { companyId: 'foreign', rewardType: 'contest', prizeFund: 999999 })],
    applications: [{ caseId: 'ours', studentId: 'one', status: 'pending', createdAt: '2026-10-01' }, { caseId: 'other', studentId: 'two', status: 'pending', createdAt: '2026-10-01' }],
    companies: [{ id: 'own', name: 'Own' }, { id: 'foreign', name: 'Foreign' }],
    projects: [{ isModerated: true, createdAt: '2026-10-01', title: 'Private scope project' }],
  }), filters, '2026-10-25')
  assert.equal(report.metrics.applications, 1)
  assert.deepEqual(report.cases.map((item) => item.id), ['ours'])
  assert.equal(report.tables.some((table) => table.title === 'Студенческие проекты'), false)
  assert.equal(summary(report, 'Заявленный призовой фонд, ₽'), 0)
})

test('counts unique team members, actual paid participants and overdue stages', () => {
  const report = buildAnalyticsReport(data({
    cases: [project('done', { status: 'completed', assignedTeamId: 'team', paymentStatus: 'paid' }), project('active', { assignedTeamId: 'team' })],
    teams: [{ id: 'team', leaderId: 'one', members: [{ id: 'one' }, { id: 'two' }] }],
    applications: [{ caseId: 'done', studentId: 'one', status: 'accepted', createdAt: '2026-10-01' }],
    evaluations: [{ caseId: 'done', winnerPlace: 1, totalScore: 90 }],
    milestones: [{ caseId: 'active', title: 'Late', status: 'pending', deadline: '2026-10-20' }, { caseId: 'active', title: 'Done', status: 'accepted', deadline: '2026-10-10' }],
  }), filters, '2026-10-25')
  assert.equal(report.metrics.participants, 2)
  assert.equal(report.metrics.overdue, 1)
  assert.equal(summary(report, 'Участников с подтвержденной выплатой'), 2)
  assert.equal(summary(report, 'Победителей (участников команд)'), 2)
  assert.equal(summary(report, 'Просрочено контрольных точек'), 1)
})

test('academic period, company, institute, course and direction filters combine', () => {
  const report = buildAnalyticsReport(data({
    cases: [project('match'), project('wrong-period', { publishedAt: '2026-08-31' }), project('wrong-direction', { direction: 'Backend' }), project('wrong-company', { companyId: 'other' })],
    students: [{ id: 'one', studentProfile: { institute: 'IT', course: 2 } }, { id: 'two', studentProfile: { institute: 'Physics', course: 3 } }],
    applications: ['match', 'wrong-period', 'wrong-direction', 'wrong-company'].map((caseId) => ({ caseId, studentId: 'one', status: 'pending', createdAt: '2026-10-01' })),
  }), { ...filters, period: '2026', company: 'own', institute: 'IT', course: '2', direction: 'Frontend' }, '2026-10-25')
  assert.deepEqual(report.cases.map((item) => item.id), ['match'])
  assert.equal(report.metrics.applications, 1)
})

test('pending publications do not inflate published cases, funds or participants', () => {
  const report = buildAnalyticsReport(data({ cases: [project('pending', { moderationStatus: 'pending', isModerated: false, rewardType: 'contest', prizeFund: 50000, assignedStudentId: 'one' })] }), filters)
  assert.equal(report.metrics.published, 0)
  assert.equal(report.metrics.pending, 1)
  assert.equal(report.metrics.participants, 0)
  assert.equal(summary(report, 'Заявленный призовой фонд, ₽'), 0)
})

test('CSV keeps Cyrillic, quotes, delimiters and formula-looking text as literals', () => {
  const csv = reportToCsv([{ title: 'Отчет', headers: ['Проект', 'Сумма'], rows: [['=HYPERLINK("url")', 25], ['Текст; "кавычки"\nСтрока', 5]] }])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""url"")"'))
  assert.ok(csv.includes('"Текст; ""кавычки""\nСтрока"'))
})
