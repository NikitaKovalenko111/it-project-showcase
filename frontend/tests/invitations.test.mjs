import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { createInvitationApi } = await import(
  await loadTs(new URL('../src/api/invitations.ts', import.meta.url))
)

test('interview and internship invitations do not send a project', async () => {
  for (const [label, kind] of [
    ['Техническое собеседование', 'interview'],
    ['Оплачиваемая стажировка', 'internship'],
  ]) {
    const requests = []
    const api = createInvitationApi({ post: async (...args) => requests.push(args) })
    await api.send('company', 'student', 'stale-project', label, ' Message ')
    assert.deepEqual(requests, [
      [
        '/companies/company/student-invitations',
        { student_id: 'student', case_id: '', kind, message: 'Message' },
      ],
    ])
  }
})

test('project invitation requires a selected project and API failures remain visible', async () => {
  const api = createInvitationApi({
    post: async () => {
      throw new Error('Permission denied')
    },
  })
  await assert.rejects(
    () => api.send('company', 'student', '', 'Участие в проекте', 'x'),
    /Выберите проект/,
  )
  await assert.rejects(
    () => api.send('company', 'student', 'project', 'Участие в проекте', 'x'),
    /Permission denied/,
  )
})
