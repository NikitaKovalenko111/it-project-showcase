import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './load-ts.mjs'

const memory = new Map()
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
const seeds = await import(await loadTs(new URL('../src/api/mockData.ts', import.meta.url)))
const { MockServer, createMockServer } = await import(await loadTs(new URL('../src/api/mockServer.ts', import.meta.url)))
const setup = () => {
  memory.clear()
  const tables = { users: 'USERS', cases: 'CASES', companies: 'COMPANIES', studentProjects: 'STUDENT_PROJECTS', applications: 'APPLICATIONS', teams: 'TEAMS', milestones: 'MILESTONES', submissions: 'SUBMISSIONS', evaluations: 'EVALUATIONS', comments: 'COMMENTS', notifications: 'NOTIFICATIONS', auditLogs: 'AUDIT_LOGS' }
  for (const [key, seed] of Object.entries(tables)) memory.set(`uust_showcase_v2_${key}`, JSON.stringify(seeds[`INITIAL_${seed}`]))
  const server = new MockServer()
  const login = (id) => localStorage.setItem('uust_current_user', JSON.stringify(server.getUserById(id)))
  return { server, login }
}

test('student publication remains private, is approved by curator and survives reload', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const created = server.createStudentProject({ ...seeds.INITIAL_STUDENT_PROJECTS[0], authorId: 'usr_student_1', title: 'New project' })
  assert.equal(created.isModerated, false)
  assert.equal(created.moderationStatus, 'pending')
  assert.ok(server.getStudentProjectById(created.id))
  login('usr_student_2')
  assert.equal(server.getStudentProjectById(created.id), undefined)
  assert.ok(!server.getStudentProjects().some((project) => project.id === created.id))
  login('usr_company_1')
  assert.throws(() => server.moderatePublication('student', created.id, 'approved'), /Нет прав/)
  login('usr_curator_1')
  const approved = server.moderatePublication('student', created.id, 'approved')
  assert.equal(approved.isModerated, true)
  login('usr_student_2')
  assert.equal(new MockServer().getStudentProjectById(created.id).moderationStatus, 'approved')
  login('usr_student_1')
  assert.ok(server.getNotifications('usr_student_1').some((item) => item.type === 'publication_status' && item.link.endsWith(created.id)))
})

test('company cannot self-publish; case appears for students only after approval', () => {
  const { server, login } = setup()
  login('usr_company_1')
  const created = server.createCase({ ...seeds.INITIAL_CASES[0], status: 'open', isModerated: true, title: 'New case' })
  assert.equal(created.status, 'moderation')
  assert.equal(created.moderationStatus, 'pending')
  const bypass = server.updateCase({ ...created, status: 'open', isModerated: true, moderationStatus: 'approved' })
  assert.equal(bypass.status, 'moderation')
  login('usr_student_1')
  assert.equal(server.getCaseById(created.id), undefined)
  assert.throws(() => server.createApplication({ caseId: created.id, companyId: created.companyId, studentId: 'usr_student_1' }), /не открыт/)
  login('usr_curator_1')
  assert.throws(() => server.moderatePublication('case', created.id, 'rejected'), /причину/)
  server.moderatePublication('case', created.id, 'approved')
  login('usr_student_1')
  assert.equal(new MockServer().getCaseById(created.id).status, 'open')
})

test('rejection and hiding remove public access, preserve reason and project progress', () => {
  const { server, login } = setup()
  login('usr_curator_1')
  const project = server.getCases().find((item) => item.status === 'in_progress')
  server.moderatePublication('case', project.id, 'hidden', 'Уточняются условия')
  login('usr_student_1')
  assert.equal(server.getCaseById(project.id), undefined)
  login('usr_curator_1')
  const restored = server.moderatePublication('case', project.id, 'approved')
  assert.equal(restored.status, 'in_progress')
  server.moderatePublication('student', 'sp_1', 'rejected', 'Нужно описание результата')
  login('usr_student_1')
  assert.equal(server.getStudentProjectById('sp_1'), undefined)
  login(seeds.INITIAL_STUDENT_PROJECTS[0].authorId)
  assert.equal(new MockServer().getStudentProjectById('sp_1').moderationComment, 'Нужно описание результата')
})

test('terminal application decision is final and participant assignment survives reload', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const base = seeds.INITIAL_APPLICATIONS[0]
  const application = server.createApplication({ ...base, caseId: 'case_3', companyId: seeds.INITIAL_CASES.find((item) => item.id === 'case_3').companyId, studentId: 'usr_student_1' })
  login('usr_admin_1')
  server.updateApplicationStatus(application.id, 'interview')
  server.updateApplicationStatus(application.id, 'need_info')
  server.updateApplicationStatus(application.id, 'accepted')
  assert.throws(() => server.updateApplicationStatus(application.id, 'rejected'), /уже принято/)
  const reloaded = new MockServer()
  assert.equal(reloaded.getCaseById('case_3').assignedStudentId, 'usr_student_1')
  assert.equal(reloaded.getApplications().find((item) => item.id === application.id).status, 'accepted')
})

test('mock API isolates requests and previous responses from later mutations', () => {
  const { login } = setup()
  const server = createMockServer()
  login('usr_student_1')
  const project = server.getCaseById('case_3')
  const count = project.applicationsCount
  Object.freeze(project)
  const application = server.createApplication({ ...seeds.INITIAL_APPLICATIONS[0], caseId: 'case_3', companyId: project.companyId, studentId: 'usr_student_1' })
  assert.equal(project.applicationsCount, count)
  assert.equal(server.getCaseById('case_3').applicationsCount, count + 1)
  login('usr_admin_1')
  server.updateApplicationStatus(application.id, 'accepted')
  assert.equal(application.status, 'pending')
  login('usr_student_1')
  const user = server.getUserById('usr_student_1')
  server.updateUser(user)
  user.fullName = 'Client-only change'
  assert.notEqual(server.getUserById(user.id).fullName, user.fullName)
})
