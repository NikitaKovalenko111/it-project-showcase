import test from 'node:test'
import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import { loadTs } from './load-ts.mjs'

const { ApplicationStatusConflict, patchApplicationStatus } = await import(
  await loadTs(new URL('../src/api/applicationStatus.ts', import.meta.url))
)
const { createHttpClient } = await import(
  await loadTs(new URL('../src/api/httpClient.ts', import.meta.url))
)

function fixture(status, rejectPatch = true) {
  const calls = []
  const http = createHttpClient({
    baseURL: '/api/v1',
    timeoutMs: 100,
    tokenStore: { get: () => null, set: () => {}, clear: () => {} },
    getRefreshToken: () => null,
    saveRefreshToken: () => {},
    onUnauthorized: () => {},
  })
  http.defaults.adapter = async (config) => {
    calls.push([config.method, config.url, config.data && JSON.parse(config.data)])
    const response = { status: 200, statusText: 'OK', headers: {}, config }
    if (rejectPatch && config.method === 'patch') {
      throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, {
        ...response,
        status: 409,
        data: {
          error: {
            code: 'invalid_application_transition',
            message: 'Application status transition is not allowed',
          },
        },
      })
    }
    return { ...response, data: { application_id: 'a', status } }
  }
  return { http, calls }
}

test('an acceptance that already succeeded refreshes the status without another mutation', async () => {
  const { http, calls } = fixture('accepted')
  const result = await patchApplicationStatus(http, 'a', 'accepted')
  assert.equal(result.application.status, 'accepted')
  assert.equal(result.changed, false)
  assert.deepEqual(calls, [
    ['patch', '/applications/a/status', { status: 'accepted' }],
    ['get', '/applications/a', undefined],
  ])
})

test('a conflicting decision includes the current status and a localized error', async () => {
  const { http } = fixture('withdrawn')
  await assert.rejects(patchApplicationStatus(http, 'a', 'accepted'), (error) => {
    assert.ok(error instanceof ApplicationStatusConflict)
    assert.equal(error.application.status, 'withdrawn')
    assert.match(error.message, /действие больше недоступно/)
    return true
  })
})

test('requesting information uses the API status and maps the updated application', async () => {
  const { http, calls } = fixture('info_requested', false)
  const result = await patchApplicationStatus(http, 'a', 'need_info', 'Уточните опыт')
  assert.equal(result.application.status, 'need_info')
  assert.equal(result.changed, true)
  assert.deepEqual(calls, [
    ['patch', '/applications/a/status', { status: 'info_requested', notes: 'Уточните опыт' }],
  ])
})
