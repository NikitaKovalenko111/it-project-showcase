import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { createWorkflow } = await import(
  await loadTs(new URL('../src/api/workflow.ts', import.meta.url))
)
function fixture() {
  const calls = []
  const state = {
    execution_id: 'e',
    case_id: 'c',
    application_id: 'a',
    status: 'accepted',
    members: [{ student_id: 's', name: 'Student' }],
  }
  const stages = [{ stage_id: 'stage', ordinal: 1, title: 'Stage', status: 'pending' }]
  const submissions = []
  const http = {
    async get(path) {
      calls.push(['GET', path])
      if (path === '/applications')
        return { data: { items: [{ execution_id: 'e' }, { execution_id: 'e' }] } }
      if (path === '/executions/e') return { data: state }
      if (path === '/executions/e/stages') return { data: { items: stages } }
      if (path === '/executions/e/submissions') return { data: { items: submissions } }
      if (path.endsWith('/evaluations')) return { data: { items: [] } }
      throw new Error('Unexpected route ' + path)
    },
    async patch(path, body) {
      calls.push(['PATCH', path, body])
      if (path === '/executions/e/status') state.status = body.status
      else stages[0].status = body.status
      return { data: {} }
    },
    async post(path, body) {
      calls.push(['POST', path, body])
      if (path.endsWith('/submissions'))
        submissions.unshift({
          ...body,
          submission_id: 'sub',
          execution_id: 'e',
          submitted_by: 's',
          submitted_at: '2026-11-05',
        })
      return { data: {} }
    },
  }
  return { api: createWorkflow(http), calls, state, stages }
}
test('execution list uses application execution IDs and snapshot members', async () => {
  const { api, calls } = fixture()
  const rows = await api.getExecutions('c')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].members[0].id, 's')
  assert.ok(!calls.some((c) => c[1] === '/cases/c/executions'))
})
test('submission starts accepted execution and sends file IDs', async () => {
  const { api, calls } = fixture()
  const result = await api.submitExecution(
    'e',
    'Solution',
    [{ name: 'x', file_id: 'f', kind: 'screenshot' }],
    'https://example.test/demo',
  )
  const start = calls.findIndex((c) => c[0] === 'PATCH')
  const submit = calls.findIndex((c) => c[0] === 'POST')
  assert.ok(start < submit)
  assert.deepEqual(calls[submit][2].files, [{ file_id: 'f', kind: 'screenshot', ordinal: 1 }])
  assert.equal(calls[submit][2].demo_url, 'https://example.test/demo')
  assert.equal(result.submission.demoUrl, 'https://example.test/demo')
})
test('stage submission follows backend state transitions', async () => {
  const { api, calls } = fixture()
  await api.updateExecutionStage('e', 'stage', 'submit', [{ file_id: 'f' }])
  assert.deepEqual(
    calls.filter((c) => c[0] === 'PATCH').map((c) => c[2].status),
    ['in_progress', 'in_progress', 'submitted'],
  )
  assert.equal(calls.find((c) => c[0] === 'POST')[2].kind, 'stage')
})
test('server errors propagate instead of returning demo executions', async () => {
  const api = createWorkflow({
    get: async () => {
      throw new Error('Permission denied')
    },
  })
  await assert.rejects(() => api.getExecutions('c'), /Permission denied/)
})

test('plan is saved atomically with exact server dates and a conflict snapshot', async () => {
  const calls = []
  const old = { stage_id: 'old', ordinal: 1, title: 'Old', due_at: '2027-01-01T10:30:00Z' }
  const api = createWorkflow({
    async get() {
      return { data: { items: [old] } }
    },
    async put(path, body) {
      calls.push([path, body])
      return { data: { items: [{ stage_id: 'new', ordinal: 1, title: 'New' }, old] } }
    },
  })
  const existing = { id: 'old', title: 'Old', description: '', deadline: '2027-01-01' }
  const result = await api.updateSharedPlan(
    'c',
    [{ id: 'plan_new', title: 'New', description: '', deadline: '' }, existing],
    [existing],
    ' Reason ',
  )
  assert.deepEqual(calls, [
    [
      '/cases/c/stages',
      {
        previous: [{ stage_id: 'old', title: 'Old', expected_result: '', due_at: old.due_at }],
        stages: [
          { stage_id: '', title: 'New', expected_result: '', due_at: null },
          { stage_id: 'old', title: 'Old', expected_result: '', due_at: old.due_at },
        ],
        reason: 'Reason',
      },
    ],
  ])
  assert.deepEqual(
    result.map((s) => s.id),
    ['new', 'old'],
  )
  await assert.rejects(() => api.updateSharedPlan('c', [], []), /План изменился/)
  assert.equal(calls.length, 1)
})

test('withdraw placements uses the canonical delete route', async () => {
  const calls = []
  await createWorkflow({ delete: async (path) => calls.push(path) }).withdrawResults('c')
  assert.deepEqual(calls, ['/cases/c/leaderboard/placements'])
})

test('placements use evaluation_status and include every evaluated participant', async () => {
  const requests = []
  const rows = [
    { execution_id: 'a', evaluation_status: 'published' },
    { execution_id: 'b', evaluation_status: 'not_evaluated' },
  ]
  const api = createWorkflow({
    async get(path) {
      assert.equal(path, '/cases/c/leaderboard')
      return { data: { items: rows } }
    },
    async put(path, body) {
      requests.push([path, body])
    },
  })
  await assert.rejects(() => api.finalizeResults('c'))
  assert.equal(requests.length, 0)
  rows[1].evaluation_status = 'published'
  await api.finalizeResults('c')
  assert.deepEqual(requests, [
    [
      '/cases/c/leaderboard/placements',
      {
        placements: [
          { execution_id: 'a', place_no: 1 },
          { execution_id: 'b', place_no: 2 },
        ],
      },
    ],
  ])
})

test('submitted execution can send a new version and ignores superseded results', async () => {
  const { api, state } = fixture()
  state.status = 'submitted'
  assert.equal((await api.getExecution('e')).canSubmitResult, true)
  const apiWithVersions = createWorkflow({
    async get(path) {
      if (path === '/executions/e') return { data: state }
      if (path.endsWith('/submissions'))
        return {
          data: {
            items: [
              { submission_id: 'old', kind: 'final', status: 'superseded' },
              { submission_id: 'current', kind: 'final', status: 'submitted' },
            ],
          },
        }
      if (path === '/submissions/old/evaluations') throw new Error('Old evaluation requested')
      return { data: { items: [] } }
    },
  })
  assert.equal((await apiWithVersions.getExecution('e')).submission.id, 'current')
})

function stageFileFixture() {
  const calls = []
  const current = {
    submission_id: 'current',
    stage_id: 'stage',
    kind: 'stage',
    status: 'submitted',
    files: [{ file_id: 'keep' }, { file_id: 'remove' }],
  }
  const api = createWorkflow({
    async get(path) {
      calls.push(['GET', path])
      if (path === '/executions')
        return { data: { items: [{ execution_id: 'e', case_id: 'c' }], next_cursor: null } }
      if (path === '/executions/e')
        return { data: { execution_id: 'e', case_id: 'c', members: [] } }
      if (path === '/executions/e/stages') return { data: { items: [{ stage_id: 'stage' }] } }
      if (path === '/executions/e/submissions')
        return {
          data: {
            items: [
              {
                submission_id: 'old',
                kind: 'stage',
                stage_id: 'stage',
                status: 'superseded',
                files: [{ file_id: 'remove' }],
              },
              current,
              { submission_id: 'final', kind: 'final', status: 'accepted', files: [] },
            ],
          },
        }
      if (path === '/submissions/final/evaluations')
        return {
          data: {
            items: [{ evaluation_id: 'grade', status: 'published', total_score: 7, max_score: 10 }],
          },
        }
      throw new Error('Unexpected route ' + path)
    },
    async delete(path) {
      calls.push(['DELETE', path])
      current.files = current.files.filter((f) => f.file_id !== 'remove')
    },
  })
  return { api, calls }
}

test('curator reads assigned submissions, files and published evaluations', async () => {
  const { api } = stageFileFixture()
  const rows = await api.getCuratedExecutions('c')
  assert.equal(rows[0].submission.id, 'final')
  assert.equal(rows[0].evaluation.totalScore, 7)
  assert.equal(rows[0].milestones[0].attachedMaterials[1].file_id, 'remove')
})

test('stage file removal uses stable file ID and current submission, not stale index', async () => {
  const { api, calls } = stageFileFixture()
  const row = await api.updateExecutionStage('e', 'stage', 'remove', [], '', 0, 'remove')
  assert.deepEqual(
    calls.filter((c) => c[0] === 'DELETE'),
    [['DELETE', '/submissions/current/files/remove']],
  )
  assert.deepEqual(
    row.milestones[0].attachedMaterials.map((f) => f.file_id),
    ['keep'],
  )
})

test('missing or changed file is never removed by index', async () => {
  const { api, calls } = stageFileFixture()
  await assert.rejects(
    () => api.updateExecutionStage('e', 'stage', 'remove', [], '', 0),
    /идентификатор/,
  )
  await assert.rejects(
    () => api.updateExecutionStage('e', 'stage', 'remove', [], '', 0, 'missing'),
    /изменились/,
  )
  assert.equal(calls.filter((c) => c[0] === 'DELETE').length, 0)
})
