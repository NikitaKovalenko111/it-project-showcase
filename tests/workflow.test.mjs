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

test('a draft plan saves through stage routes supported by the backend', async () => {
  const calls = []
  const stages = [{ stage_id: 'old', ordinal: 1, title: 'Old' }]
  const api = createWorkflow({
    async get(path) {
      assert.equal(path, '/cases/c/stages')
      return { data: { items: [...stages] } }
    },
    async post(path, body) {
      calls.push(['POST', path])
      stages.push({ ...body, stage_id: 'new' })
      return { data: { stage_id: 'new' } }
    },
    async put(path, body) {
      calls.push(['PUT', path, body])
      stages.reverse().forEach((stage, i) => {
        stage.ordinal = i + 1
      })
    },
  })
  const existing = { id: 'old', title: 'Old', description: '', deadline: '' }
  const result = await api.updateSharedPlan(
    'c',
    [{ id: 'plan_new', title: 'New', description: '', deadline: '' }, existing],
    [existing],
  )
  assert.deepEqual(calls, [
    ['POST', '/cases/c/stages'],
    ['PUT', '/cases/c/stages/order', { stage_ids: ['new', 'old'] }],
  ])
  assert.deepEqual(
    result.map((stage) => stage.id),
    ['new', 'old'],
  )
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
