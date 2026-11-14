import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
}
const { MockServer } = await import(
  await loadTs(new URL('../src/api/mockServer.ts', import.meta.url))
)

test('standalone catalogs have the documented volume and valid references after reload', () => {
  memory.clear()
  new MockServer()
  const rows = (name) => JSON.parse(memory.get('uust_showcase_curated_v1_' + name))
  const counts = Object.fromEntries(
    ['users', 'companies', 'cases', 'studentProjects', 'applications', 'teams', 'executions'].map(
      (name) => [name, rows(name).length],
    ),
  )
  assert.deepEqual(counts, {
    users: 46,
    companies: 13,
    cases: 49,
    studentProjects: 15,
    applications: 39,
    teams: 28,
    executions: 36,
  })
  assert.equal(rows('users').filter((user) => user.role === 'student').length, 37)
  const users = new Set(rows('users').map((row) => row.id))
  const companies = new Set(rows('companies').map((row) => row.id))
  const cases = new Set(rows('cases').map((row) => row.id))
  for (const row of rows('cases')) assert.ok(companies.has(row.companyId))
  for (const row of rows('studentProjects')) assert.ok(users.has(row.authorId))
  for (const row of rows('applications')) {
    assert.ok(cases.has(row.caseId))
    assert.ok(users.has(row.studentId))
  }
  const serialized = memory.get('uust_showcase_curated_v1_cases')
  new MockServer()
  assert.equal(memory.get('uust_showcase_curated_v1_cases'), serialized)
})

const { buildPrograms, buildProgramApplications } = await import(
  await loadTs(new URL('../src/api/fixtures/programs.ts', import.meta.url))
)

test('curated records have unique names, matching author snapshots and usable local materials', () => {
  memory.clear()
  new MockServer()
  const rows = (name) => JSON.parse(memory.get('uust_showcase_curated_v1_' + name))
  const users = new Map(rows('users').map((user) => [user.id, user]))
  const companies = new Map(rows('companies').map((company) => [company.id, company]))
  const cases = new Map(rows('cases').map((project) => [project.id, project]))
  const unique = (items, key) =>
    assert.equal(new Set(items.map((item) => item[key])).size, items.length, key)
  unique([...users.values()], 'fullName')
  unique([...users.values()], 'email')
  unique([...cases.values()], 'title')
  unique(rows('studentProjects'), 'title')
  for (const item of cases.values()) {
    assert.equal(item.companyName, companies.get(item.companyId).name)
    assert.equal(item.fullDescription.includes('\\n'), false)
    for (const material of ['fullDescription', 'shortDescription', 'resultRequirements'])
      assert.ok(item[material].length > 30)
    assert.equal(
      item.applicationsCount,
      rows('applications').filter((app) => app.caseId === item.id).length,
    )
  }
  for (const item of rows('studentProjects'))
    assert.equal(item.authorName, users.get(item.authorId).fullName)
  for (const item of rows('applications')) {
    assert.equal(item.studentName, users.get(item.studentId).fullName)
    assert.equal(item.studentEmail, users.get(item.studentId).email)
    assert.equal(item.caseTitle, cases.get(item.caseId).title)
    assert.equal(item.companyId, cases.get(item.caseId).companyId)
  }
  for (const team of rows('teams')) {
    assert.ok(cases.has(team.caseId || team.recruitingCaseId))
    assert.equal(team.leaderName, users.get(team.leaderId).fullName)
    for (const member of team.members) assert.equal(member.name, users.get(member.id).fullName)
  }
  const before = rows('executions')
  new MockServer()
  assert.deepEqual(rows('executions'), before)
  for (const entry of before) {
    assert.ok(cases.has(entry.caseId))
    for (const file of entry.submission?.attachedFiles || []) {
      assert.ok(file && file.name && file.url.startsWith('data:text/plain'))
      assert.ok(decodeURIComponent(file.url.split(',')[1]).length > 60)
    }
  }
  const programs = buildPrograms()
  assert.equal(programs.length, 14)
  unique(programs, 'title')
  for (const program of programs)
    assert.equal(program.company_name, companies.get(program.company_id).name)
  for (const application of buildProgramApplications()) {
    assert.ok(programs.some((program) => program.program_id === application.program_id))
    assert.equal(application.student_name, users.get(application.student_id).fullName)
  }
  const content = JSON.stringify([...memory.values(), programs])
  assert.doesNotMatch(
    content,
    /Магасумов|Алмаз|257576|petrov|example\.com| — этап \d| — набор \d|Демо жюри|Демонстрационная регистрация/u,
  )
})

test('previous browser-created records remain isolated while curated edits survive a reload', () => {
  memory.clear()
  const oldKey = 'uust_showcase_v2_cases'
  const oldRows = JSON.stringify([{ id: 'manual-project', title: 'Старый случайный проект' }])
  memory.set(oldKey, oldRows)
  memory.set(
    'uust_showcase_v2_users',
    JSON.stringify([{ id: 'manual-student', fullName: 'Случайное имя' }]),
  )
  const server = new MockServer()
  assert.equal(server.getUserById('manual-student'), undefined)
  assert.equal(server.getCaseById('manual-project'), undefined)
  assert.equal(memory.get(oldKey), oldRows)
  const user = server.getUserById('usr_student_1')
  memory.set('uust_current_user', JSON.stringify(user))
  server.updateUser({
    ...user,
    studentProfile: { ...user.studentProfile, bio: 'Изменённый профиль для демонстрации' },
  })
  assert.equal(
    new MockServer().getUserById(user.id).studentProfile.bio,
    'Изменённый профиль для демонстрации',
  )
})

test('team recruitment fixtures offer incoming, outgoing and open teams without losing user decisions', () => {
  memory.clear()
  const server = new MockServer()
  const login = id => localStorage.setItem('uust_current_user', JSON.stringify(server.getUserById(id)))
  login('usr_student_1')
  const requests = server.getTeamRequests()
  assert.ok(requests.some(row => row.kind === 'invitation' && row.studentId === 'usr_student_1'))
  assert.ok(requests.some(row => row.kind === 'application' && row.senderId === 'usr_student_1'))
  const teams = JSON.parse(memory.get('uust_showcase_curated_v1_teams'))
  assert.equal(teams.filter(team => team.id.startsWith('recruiting_') && !team.caseId).length, 3)
  const invite = requests.find(row => row.id === 'seed_incoming_invitation')
  server.decideTeamRequest(invite.id, 'rejected')
  const reloaded = new MockServer()
  assert.equal(reloaded.getTeamRequests().find(row => row.id === invite.id).status, 'rejected')
})
