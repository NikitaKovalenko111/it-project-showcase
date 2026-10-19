import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './load-ts.mjs'

const memory = new Map()
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
const { MockServer } = await import(await loadTs(new URL('../src/api/mockServer.ts', import.meta.url)))
const { canManageCase, participatesInCase } = await import(await loadTs(new URL('../src/utils/access.ts', import.meta.url)))
const server = new MockServer()
const login = (id) => { localStorage.setItem('uust_current_user', JSON.stringify(server.getUserById(id))) }

test('curator observes projects but cannot accept stages, evaluate, invite or change applications', () => {
  login('usr_curator_1')
  const project = server.getCases()[0]
  assert.equal(canManageCase(server.getUserById('usr_curator_1'), project), false)
  assert.throws(() => server.updateCase(project), /Нет прав/)
  assert.throws(() => server.updateMilestoneStatus(server.getMilestones(project.id)[0].id, 'accepted'), /Нет прав/)
  assert.throws(() => server.createEvaluation({ caseId: project.id }), /Нет прав/)
  assert.throws(() => server.inviteStudent('usr_student_1', project.id, 'case', 'test'), /только компания/)
  assert.throws(() => server.updateApplicationStatus(server.getApplications()[0].id, 'accepted'), /Нет прав/)
})
test('company reads only its own cases and applications and cannot manage a different company', () => {
  login('usr_company_1')
  const user = server.getUserById('usr_company_1')
  assert.ok(server.getCases().length > 0)
  assert.ok(server.getCases().every((project) => project.companyId === user.companyProfile.companyId))
  assert.ok(server.getApplications().every((app) => app.companyId === user.companyProfile.companyId))
  assert.equal(server.getCaseById('case_2'), undefined)
  assert.throws(() => server.createMilestone('case_2', { title: 'No', deadline: '2026-12-01', description: '' }), /Нет прав/)
})
test('milestones survive a server reload and deletion renumbers remaining steps', () => {
  login('usr_company_1')
  const before = server.getMilestones('case_1').length
  const added = server.createMilestone('case_1', { title: 'Новый этап', deadline: '2026-12-01', description: 'Проверка' })
  assert.equal(new MockServer().getMilestones('case_1').length, before + 1)
  server.deleteMilestone(added.id)
  assert.equal(new MockServer().getMilestones('case_1').length, before)
  assert.deepEqual(server.getMilestones('case_1').map((m) => m.stepNumber), Array.from({ length: before }, (_, i) => i + 1))
})
test('portfolio participation is based on assignment or membership, not project status', () => {
  const project = { id: 'case', status: 'completed', assignedTeamId: 'team' }
  assert.equal(participatesInCase('stranger', project, []), false)
  assert.equal(participatesInCase('member', project, [{ id: 'team', members: [{ id: 'member' }] }]), true)
  assert.equal(participatesInCase('author', { ...project, assignedStudentId: 'author' }, []), true)
})
