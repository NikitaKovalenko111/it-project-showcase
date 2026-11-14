import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const memory = new Map()
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
}
const { MockServer } = await import(
  await loadTs(new URL('../src/api/mockServer.ts', import.meta.url))
)
function setup() {
  memory.clear()
  const server = new MockServer()
  const login = (id) =>
    localStorage.setItem('uust_current_user', JSON.stringify(server.getUserById(id)))
  return { server, login }
}
test('olympiad registration is immediately accepted and has a private execution after reload', () => {
  const { server, login } = setup()
  login('usr_student_2')
  const user = server.getUserById('usr_student_2'),
    project = server.getCaseById('demo_olympiad')
  const app = server.createApplication({
    caseId: project.id,
    caseTitle: project.title,
    companyId: project.companyId,
    studentId: user.id,
    studentName: user.fullName,
    applicantType: 'individual',
    coverLetter: '',
  })
  assert.equal(app.status, 'accepted')
  const entries = new MockServer().getExecutions(project.id)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].studentId, user.id)
  assert.throws(() => server.createApplication({ ...app }), /уже/)
  login('usr_company_1')
  assert.throws(() => server.updateApplicationStatus(app.id, 'rejected'), /уже/)
})
test('grading one team keeps other results and case lifecycle unchanged; privileges and bounds are enforced', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const before = structuredClone(server.getExecutions('demo_hackathon'))
  assert.equal(before.length, 12)
  const entry = before.find((e) => e.status === 'submitted'),
    peer = before.find((e) => e.id !== entry.id && e.evaluation)
  const state = server.getCaseById('demo_hackathon').status
  server.gradeExecution(entry.id, { quality: 8, architecture: 9 }, 'Проверено')
  const reloaded = new MockServer(),
    after = reloaded.getExecutions('demo_hackathon')
  assert.equal(after.find((e) => e.id === entry.id).evaluation.totalScore, 17)
  assert.deepEqual(
    after.find((e) => e.id === peer.id),
    peer,
  )
  assert.equal(reloaded.getCaseById('demo_hackathon').status, state)
  assert.equal(reloaded.getLeaderboard('demo_hackathon').complete, false)
  assert.throws(
    () => server.gradeExecution(entry.id, { quality: 11, architecture: 9 }, ''),
    /пределах/,
  )
  login('usr_student_1')
  assert.equal(server.getExecutions('demo_hackathon').length, 1)
  assert.throws(() => server.gradeExecution(entry.id, { quality: 8, architecture: 9 }, ''), /прав/)
  assert.throws(() => server.submitExecution(entry.id, 'Чужая работа', []), /прав/)
})
test('olympiad sums task points instead of using weighted ten-point criteria', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const entry = server.getExecutions('demo_olympiad').find((e) => e.status === 'submitted')
  const result = server.gradeExecution(entry.id, { a: 25, b: 60 }, '')
  assert.equal(result.evaluation.totalScore, 85)
  assert.equal(result.evaluation.maxScore, 100)
  assert.throws(() => server.gradeExecution(entry.id, { a: 31, b: 60 }, ''), /пределах/)
})
test('publishing standings requires all submitted works graded and closes submission and grading', () => {
  const { server, login } = setup()
  login('usr_company_1')
  assert.throws(() => server.finalizeResults('demo_olympiad'), /Сначала/)
  for (const entry of server
    .getExecutions('demo_olympiad')
    .filter((e) => e.submission && !e.evaluation))
    server.gradeExecution(entry.id, { a: 20, b: 50 }, '')
  assert.equal(server.getLeaderboard('demo_olympiad').complete, false)
  server.finalizeResults('demo_olympiad')
  assert.equal(server.getLeaderboard('demo_olympiad').complete, true)
  assert.equal(server.getLeaderboard('demo_olympiad').items.length, 9)
  const entry = server.getExecutions('demo_olympiad')[0]
  assert.throws(() => server.gradeExecution(entry.id, { a: 20, b: 50 }, ''), /зафиксированы/)
  login('usr_student_1')
  assert.throws(() => server.submitExecution(entry.id, 'Другая версия', []), /завершён/)
})
test('stage files and reviews are isolated by execution and persist across reload', () => {
  const { server, login } = setup()
  login('usr_company_1')
  server.createMilestone('demo_hackathon', {
    title: 'Прототип',
    description: 'Первый результат',
    deadline: '2027-01-01',
  })
  const entries = server.getExecutions('demo_hackathon'),
    own = entries.find((e) => e.status === 'active'),
    peer = entries.find((e) => e.id !== own.id)
  const peerMaterials = structuredClone(peer.milestones[0].attachedMaterials)
  const stage = own.milestones[0]
  login(own.studentId)
  server.updateExecutionStage(own.id, stage.id, 'submit', [
    { name: 'prototype.txt', url: 'data:text/plain,own' },
  ])
  assert.throws(
    () =>
      server.updateExecutionStage(peer.id, peer.milestones[0].id, 'submit', [
        { name: 'x', url: 'x' },
      ]),
    /участникам/,
  )
  assert.throws(() => server.updateExecutionStage(own.id, stage.id, 'accepted'), /прав/)
  login('usr_company_1')
  assert.deepEqual(
    new MockServer().getExecutions('demo_hackathon').find((e) => e.id === peer.id).milestones[0]
      .attachedMaterials,
    peerMaterials,
  )
  server.updateExecutionStage(own.id, stage.id, 'accepted')
  login(own.studentId)
  assert.equal(new MockServer().getExecutions('demo_hackathon')[0].milestones[0].status, 'accepted')
  assert.throws(
    () => server.updateExecutionStage(own.id, stage.id, 'remove', [], '', 0),
    /Принятый/,
  )
})
test('portfolio achievements exclude participation without a graded submitted work', () => {
  const { server, login } = setup()
  login('usr_company_1')
  for (const e of server
    .getExecutions('demo_olympiad')
    .filter((e) => e.submission && !e.evaluation))
    server.gradeExecution(e.id, { a: 20, b: 50 }, '')
  server.finalizeResults('demo_olympiad')
  assert.equal(
    server.getStudentAchievements('usr_student_1').filter((a) => a.caseId === 'demo_olympiad')
      .length,
    1,
  )
  assert.equal(
    server.getStudentAchievements('demo_student_11').filter((a) => a.caseId === 'demo_olympiad')
      .length,
    0,
  )
})
test('shared plan updates all teams without resetting submitted work, and blocks deleting used stages', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const plan = server.getSharedPlan('demo_hackathon')
  let entry = server.getExecutions('demo_hackathon').find((e) => e.status === 'active')
  login(entry.studentId)
  server.updateExecutionStage(entry.id, entry.milestones[0].id, 'submit', [
    { name: 'proto.txt', url: 'data:text/plain,proto' },
  ])
  login('usr_company_1')
  server.updateExecutionStage(entry.id, entry.milestones[0].id, 'accepted', [], 'Принято')
  const revised = plan
    .map((m, i) => ({ ...m, title: `Новый этап ${i + 1}`, deadline: '2027-06-20' }))
    .reverse()
  server.updateSharedPlan('demo_hackathon', revised)
  const reloaded = new MockServer(),
    all = reloaded.getExecutions('demo_hackathon')
  assert.equal(all.length, 12)
  for (const e of all) {
    assert.equal(e.milestones.find((s) => s.id.endsWith(`::${plan[0].id}`)).deadline, '2027-06-20')
  }
  entry = all.find((e) => e.id === entry.id)
  const accepted = entry.milestones.find((s) => s.id.endsWith(`::${plan[0].id}`))
  assert.equal(accepted.status, 'accepted')
  assert.equal(accepted.attachedMaterials[0].name, 'proto.txt')
  assert.equal(accepted.feedback, 'Принято')
  assert.equal(accepted.stepNumber, 3)
  assert.throws(
    () =>
      reloaded.updateSharedPlan(
        'demo_hackathon',
        revised.filter((r) => r.id !== plan[0].id),
      ),
    /начата работа/,
  )
  assert.equal(reloaded.getSharedPlan('demo_hackathon').length, 3)
  login('usr_student_1')
  assert.throws(() => server.updateSharedPlan('demo_hackathon', revised), /прав/)
})
test('curator can monitor every execution but cannot submit or grade participants work', () => {
  const { server, login } = setup()
  login('usr_curator_1')
  const entries = server.getExecutions('demo_hackathon')
  assert.equal(entries.length, 12)
  const entry = entries.find((e) => e.status === 'submitted')
  assert.throws(() => server.submitExecution(entry.id, 'Not my work', []), /прав/)
  assert.throws(
    () => server.gradeExecution(entry.id, { quality: 9, architecture: 9 }, 'No'),
    /прав/,
  )
  assert.throws(
    () => server.updateSharedPlan('demo_hackathon', server.getSharedPlan('demo_hackathon')),
    /прав/,
  )
  login('usr_student_1')
  assert.equal(new MockServer().getExecutions('demo_hackathon').length, 1)
})

test('unused shared stages can be removed for everyone, while closed event plans are immutable', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const plan = server.getSharedPlan('demo_olympiad')
  server.getExecutions('demo_olympiad')
  server.updateSharedPlan('demo_olympiad', plan.slice(1))
  assert.ok(server.getExecutions('demo_olympiad').every((e) => e.milestones.length === 2))
  for (const e of server
    .getExecutions('demo_olympiad')
    .filter((e) => e.submission && !e.evaluation))
    server.gradeExecution(e.id, { a: 20, b: 50 }, '')
  server.finalizeResults('demo_olympiad')
  assert.throws(() => server.updateSharedPlan('demo_olympiad', plan), /завершён/)
})

test('company can withdraw only its own pending case without deleting its plan', () => {
  const { server, login } = setup()
  login('usr_student_1')
  assert.throws(() => server.withdrawCaseModeration('demo_case_review'), /прав/)
  login('usr_company_1')
  const before = server.getSharedPlan('demo_case_review')
  const project = server.withdrawCaseModeration('demo_case_review')
  assert.equal(project.status, 'revision')
  assert.equal(project.isModerated, false)
  assert.deepEqual(server.getSharedPlan(project.id), before)
  assert.equal(new MockServer().getCaseById(project.id).moderationStatus, 'revision')
  assert.throws(() => server.withdrawCaseModeration('case_1'), /модерации/)
})

test('curated teams differ in size, submissions differ in completeness, and edits survive reload', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const entries = server.getExecutions('demo_hackathon')
  assert.equal(entries.length, 12)
  assert.deepEqual([...new Set(entries.map((e) => e.members.length))].sort(), [1, 2, 3, 4])
  assert.equal(entries.filter((e) => e.submission).length, 9)
  assert.ok(entries.some((e) => e.submission?.attachedFiles.length === 1))
  assert.ok(entries.some((e) => e.submission?.attachedFiles.length === 2))
  const stored = JSON.parse(memory.get('uust_showcase_curated_v1_companies'))
  stored[0].description = 'Описание, изменённое пользователем вручную.'
  localStorage.setItem('uust_showcase_curated_v1_companies', JSON.stringify(stored))
  localStorage.removeItem?.('uust_showcase_curated_v1_fixture_quality_20261114')
  memory.delete('uust_showcase_curated_v1_fixture_quality_20261114')
  const reloaded = new MockServer()
  assert.equal(reloaded.getCompanyById(stored[0].id).description, stored[0].description)
})

test('detailed fixtures upgrade unchanged text while preserving user edits and record counts', async () => {
  const { server, login } = setup()
  login('usr_admin_1')
  const { buildCases, buildStudents, buildPortfolio, buildCompanies } = await import(
    await loadTs(new URL('../src/api/fixtures/builders.ts', import.meta.url))
  )
  const prefix = 'uust_showcase_curated_v1_'
  const cases = JSON.parse(memory.get(prefix + 'cases')),
    users = JSON.parse(memory.get(prefix + 'users')),
    projects = JSON.parse(memory.get(prefix + 'studentProjects')),
    companies = JSON.parse(memory.get(prefix + 'companies'))
  const oldCase = buildCases(false)[0],
    oldStudent = buildStudents(false)[0],
    oldProject = buildPortfolio(false)[0],
    oldCompany = buildCompanies(false)[0]
  cases.find((item) => item.id === oldCase.id).fullDescription = oldCase.fullDescription
  cases[1].fullDescription = 'Текст, самостоятельно изменённый пользователем.'
  users.find((item) => item.id === oldStudent.id).studentProfile.bio = oldStudent.studentProfile.bio
  projects.find((item) => item.id === oldProject.id).fullDescription = oldProject.fullDescription
  companies.find((item) => item.id === oldCompany.id).description = oldCompany.description
  for (const [key, value] of Object.entries({ cases, users, studentProjects: projects, companies }))
    localStorage.setItem(prefix + key, JSON.stringify(value))
  memory.delete(prefix + 'fixture_details_20261114_v2')
  const reloaded = new MockServer()
  assert.ok(
    reloaded.getCaseById(oldCase.id).fullDescription.length > oldCase.fullDescription.length * 2,
  )
  assert.equal(reloaded.getCaseById(cases[1].id).fullDescription, cases[1].fullDescription)
  assert.ok(
    reloaded.getUserById(oldStudent.id).studentProfile.bio.length >
      oldStudent.studentProfile.bio.length * 2,
  )
  assert.ok(
    reloaded.getStudentProjectById(oldProject.id).fullDescription.length >
      oldProject.fullDescription.length * 2,
  )
  assert.ok(
    reloaded.getCompanyById(oldCompany.id).description.length > oldCompany.description.length,
  )
  for (const [key, value] of Object.entries({ cases, users, studentProjects: projects, companies }))
    assert.equal(JSON.parse(memory.get(prefix + key)).length, value.length)
})

test('profile fixtures fill blank fields and preserve edited contacts, documents and progress', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const teams = server.getExecutions('demo_hackathon')
  assert.ok(new Set(teams.map((e) => e.milestones.map((m) => m.status).join(','))).size >= 3)
  assert.ok(teams.some((e) => e.milestones.some((m) => m.feedback && m.attachedMaterials.length)))
  const companyKey = 'uust_showcase_curated_v1_companies'
  const companies = JSON.parse(memory.get(companyKey))
  const count = companies.length
  companies[0].phone = '+7 (000) 999-99-99'
  companies[0].documents = [{ name: 'Мой документ', url: 'data:text/plain,custom' }]
  companies[1].inn = ''
  memory.set(companyKey, JSON.stringify(companies))
  memory.delete('uust_showcase_curated_v1_fixture_profiles_20261114_v3')
  const reloaded = new MockServer()
  const result = JSON.parse(memory.get(companyKey))
  assert.equal(result.length, count)
  assert.equal(result[0].phone, '+7 (000) 999-99-99')
  assert.deepEqual(result[0].documents, companies[0].documents)
  assert.match(result[1].inn, /^\d{10}$/)
  const student = reloaded.getUserById('usr_student_1').studentProfile
  assert.ok(student.resume.url.endsWith('.pdf'))
  assert.ok(student.phone && student.portfolioUrl && student.files.length)
  assert.deepEqual(
    JSON.parse(JSON.stringify(reloaded.getExecutions('demo_hackathon'))),
    JSON.parse(JSON.stringify(teams)),
  )
})
