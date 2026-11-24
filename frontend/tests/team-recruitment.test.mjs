import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { createTeamRecruitmentApi } = await import(
  await loadTs(new URL('../src/api/teamRecruitment.ts', import.meta.url))
)

test('team recruitment updates discovery and preserves the team description', async () => {
  const calls = []
  const api = createTeamRecruitmentApi({ put: async (...args) => calls.push(args) })
  const team = { id: 'team', name: 'Команда', description: 'О команде' }
  await api.setOpen(team, true)
  await api.setOpen(team, false)
  assert.deepEqual(calls, [
    [
      '/teams/team/discovery',
      {
        name: team.name,
        description: team.description,
        visibility: 'open',
        looking_for_members: true,
      },
    ],
    [
      '/teams/team/discovery',
      {
        name: team.name,
        description: team.description,
        visibility: 'private',
        looking_for_members: false,
      },
    ],
  ])
})

test('invitation sends the server ID unchanged and identifies unsupported IDs', async () => {
  const team = '4bdb38e2-feca-4dd8-9489-cd6648851f44'
  const student = '4bdb38e2-feca-4dd8-9489-cd6648851f45'
  const calls = []
  const api = createTeamRecruitmentApi({ post: async (...args) => calls.push(args) })
  await assert.rejects(api.invite(team, student.replace('-4dd8-', '-fdd8-')), /ID этого студента/)
  await api.invite(team, student)
  assert.deepEqual(calls, [[`/teams/${team}/invitations`, { student_id: student }]])
})
