import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './load-ts.mjs'
const memory = new Map()
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
}
const seeds = await import(await loadTs(new URL('../src/api/mockData.ts', import.meta.url)))
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
test('private project disappears for other students and resubmission requires moderation', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const project = server.getStudentProjects().find((p) => p.authorId === 'usr_student_1')
  server.setStudentProjectVisibility(project.id, 'private')
  login('usr_student_2')
  assert.equal(server.getStudentProjectById(project.id), undefined)
  assert.throws(() => server.setStudentProjectVisibility(project.id, 'public'), /Нет прав/)
  login('usr_curator_1')
  assert.equal(new MockServer().getStudentProjectById(project.id), undefined)
  login('usr_student_1')
  const submitted = server.setStudentProjectVisibility(project.id, 'public')
  assert.equal(submitted.isModerated, false)
  assert.equal(submitted.moderationStatus, 'pending')
  login('usr_student_2')
  assert.equal(new MockServer().getStudentProjectById(project.id), undefined)
})
test('recruiting a team does not grant access to workspace submission before acceptance', async () => {
  const { server, login } = setup()
  login('usr_student_1')
  const team = server.createTeam({ name: 'Prospective team' })
  server.linkTeamToCase(team.id, 'case_2')
  const linked = server.getTeams().find((t) => t.id === team.id)
  assert.equal(linked.recruitingCaseId, 'case_2')
  assert.equal(linked.caseId, undefined)
  const { participatesInCase } = await import(
    await loadTs(new URL('../src/utils/access.ts', import.meta.url))
  )
  assert.equal(participatesInCase('usr_student_1', server.getCaseById('case_2'), [linked]), false)
})
test('team invitation changes membership only after recipient acceptance and survives reload', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const team = server.createTeam({ name: 'Real team', members: [{ id: 'fake' }] })
  assert.deepEqual(
    team.members.map((m) => m.id),
    ['usr_student_1'],
  )
  const request = server.requestTeam(team.id, 'usr_student_2', 'invitation', 'Join us')
  assert.equal(team.members.length, 1)
  assert.throws(() => server.decideTeamRequest(request.id, 'accepted'), /Нет прав/)
  login('usr_student_2')
  server.decideTeamRequest(request.id, 'accepted')
  assert.ok(
    new MockServer()
      .getTeams()
      .find((t) => t.id === team.id)
      .members.some((m) => m.id === 'usr_student_2'),
  )
  assert.throws(() => server.decideTeamRequest(request.id, 'accepted'), /уже/)
})
test('captain decides applications; duplicate pending requests are rejected', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const team = server.createTeam({ name: 'Recruiting' })
  login('usr_student_2')
  const request = server.requestTeam(team.id, 'usr_student_2', 'application', 'I can help')
  assert.throws(() => server.requestTeam(team.id, 'usr_student_2', 'application', 'Again'), /уже/)
  assert.throws(() => server.decideTeamRequest(request.id, 'accepted'), /Нет прав/)
  login('usr_student_1')
  server.decideTeamRequest(request.id, 'accepted')
  assert.equal(server.getTeams().find((t) => t.id === team.id).members.length, 2)
})
test('a candidate can publish without a project and update the same profile after reload', () => {
  const { server, login } = setup()
  login('usr_student_2')
  server.saveSeeker(undefined, 'Frontend developer', [' React ', ''])
  let reloaded = new MockServer()
  assert.equal(reloaded.getSeekers().filter((s) => s.studentId === 'usr_student_2').length, 1)
  assert.equal(
    reloaded.getSeekers('case_2').find((s) => s.studentId === 'usr_student_2').message,
    'Frontend developer',
  )
  reloaded.saveSeeker('case_2', 'Updated profile', ['TypeScript'])
  reloaded = new MockServer()
  const own = reloaded.getSeekers().filter((s) => s.studentId === 'usr_student_2')
  assert.equal(own.length, 1)
  assert.equal(own[0].message, 'Updated profile')
  assert.equal(own[0].caseId, 'case_2')
  assert.throws(() => reloaded.saveSeeker(undefined, '   ', []), /Заполните/)
  login('usr_company_1')
  assert.throws(() => reloaded.saveSeeker(undefined, 'No', []), /Заполните/)
})

test('only the captain can invite, including after a member has joined', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const team = server.createTeam({ name: 'Captain permissions' })
  const invitation = server.requestTeam(team.id, 'usr_student_2', 'invitation', 'Join')
  login('usr_student_2')
  server.decideTeamRequest(invitation.id, 'accepted')
  assert.throws(() => server.requestTeam(team.id, 'usr_student_3', 'invitation', 'No'), /прав/)
  login('usr_student_1')
  assert.equal(server.requestTeam(team.id, 'usr_student_3', 'invitation', 'Join').status, 'pending')
})

test('invitations retain sender, company, conversation and a final decision', () => {
  const { server, login } = setup()
  login('usr_company_1')
  server.inviteStudent('usr_student_2', 'case_1', 'Interview', 'Hello')
  const notification = server
    .getNotifications('usr_student_2')
    .find((n) => n.invitation?.reason === 'Interview')
  login('usr_student_2')
  assert.equal(server.getInvitation(notification.id).invitation.companyId, 'comp_1')
  server.respondInvitation(notification.id, undefined, 'Can we discuss details?')
  server.respondInvitation(notification.id, 'accepted')
  assert.throws(() => server.respondInvitation(notification.id, 'rejected'), /недоступно/)
  login('usr_company_1')
  const reloaded = new MockServer().getInvitation(notification.id)
  assert.equal(reloaded.invitation.status, 'accepted')
  assert.equal(reloaded.invitation.replies.length, 1)
  login('usr_curator_1')
  assert.throws(() => server.getInvitation(notification.id), /недоступно/)
})
test('comment replies keep their parent and likes toggle per actual actor', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const parent = server.addComment({ caseId: 'case_2', content: 'Question', authorId: 'spoofed' })
  assert.equal(parent.authorId, 'usr_student_1')
  const reply = server.addComment({ caseId: 'case_2', content: 'Reply', parentId: parent.id })
  assert.equal(reply.parentId, parent.id)
  assert.equal(server.likeComment(parent.id).likedBy.length, 1)
  assert.equal(server.likeComment(parent.id).likedBy.length, 0)
  assert.throws(
    () => server.addComment({ caseId: 'case_1', parentId: parent.id, content: 'Wrong project' }),
    /не найден/,
  )
})
test('complaints are deduplicated and review is restricted to admin', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const report = server.reportContent('case', 'case_2', 'Спам', 'Details')
  assert.throws(() => server.reportContent('case', 'case_2', 'Спам', ''), /уже/)
  assert.throws(() => server.getReports(), /администратору/)
  login('usr_admin_1')
  server.resolveReport(report.id)
  assert.equal(new MockServer().getReports()[0].status, 'resolved')
})
test('company program permissions and curator assignments persist', () => {
  const { server, login } = setup()
  login('usr_company_1')
  server.updateCompanyContent('comp_1', {
    description: 'Description',
    internshipProgram: 'Our actual program',
  })
  assert.throws(
    () => server.updateCompanyContent('comp_2', { description: 'No', internshipProgram: 'No' }),
    /Нет прав/,
  )
  login('usr_curator_1')
  server.assignStudentCurator('usr_student_2', 'usr_curator_1')
  assert.equal(
    new MockServer().getUserById('usr_student_2').studentProfile.curatorId,
    'usr_curator_1',
  )
  assert.equal(new MockServer().getCompanyById('comp_1').internshipProgram, 'Our actual program')
})
test('team cap prevents accepting excess applications without changing their status', () => {
  const env = setup()
  env.login('usr_company_1')
  const applications = JSON.parse(memory.get('uust_showcase_v2_applications'))
  applications.push({
    ...applications[1],
    id: 'excess',
    caseId: 'case_1',
    companyId: 'comp_1',
    status: 'pending',
  })
  memory.set('uust_showcase_v2_applications', JSON.stringify(applications))
  const server = new MockServer()
  const project = server.getCaseById('case_1')
  server.updateCase({ ...project, maxTeams: 1 })
  const accepted = server.getApplications('case_1').filter((a) => a.status === 'accepted')
  const pending = server
    .getApplications('case_1')
    .filter((a) => !['accepted', 'rejected'].includes(a.status))
  if (!accepted.length) server.updateApplicationStatus(pending.shift().id, 'accepted')
  assert.throws(() => server.updateApplicationStatus(pending[0].id, 'accepted'), /Лимит/)
  assert.notEqual(
    server.getApplications('case_1').find((a) => a.id === pending[0].id).status,
    'accepted',
  )
})

test('only admin suspends companies; state persists and company disappears from student catalog', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const company = server.getCompanies()[0]
  assert.throws(() => server.suspendCompany(company.id), /прав|администратор/i)
  const admin = server.getUsers().find((u) => u.role === 'admin')
  login(admin.id)
  assert.equal(server.suspendCompany(company.id).isBlocked, true)
  assert.equal(new MockServer().getCompanies().find((c) => c.id === company.id).isBlocked, true)
  login('usr_student_1')
  assert.equal(
    new MockServer().getCompanies().some((c) => c.id === company.id),
    false,
  )
})

test('project likes toggle once per actor and survive reload', () => {
  const { server, login } = setup()
  login('usr_student_1')
  const project = server.getStudentProjects().find((p) => p.isModerated)
  const baseline = project.likesCount
  assert.equal(server.toggleStudentProjectLike(project.id).likesCount, baseline + 1)
  assert.equal(new MockServer().getStudentProjectById(project.id).likedByMe, true)
  assert.equal(
    new MockServer().getStudentProjects().find((p) => p.id === project.id).likedByMe,
    true,
  )
  login('usr_student_2')
  assert.equal(server.getStudentProjectById(project.id).likedByMe, false)
  assert.equal(server.toggleStudentProjectLike(project.id).likesCount, baseline + 2)
  login('usr_student_1')
  assert.equal(server.toggleStudentProjectLike(project.id).likesCount, baseline + 1)
  for (let i = 0; i < 10; i++) server.toggleStudentProjectLike(project.id)
  assert.equal(server.getStudentProjectById(project.id).likesCount, baseline + 1)
  login('usr_student_2')
  assert.equal(server.toggleStudentProjectLike(project.id).likesCount, baseline)
})
