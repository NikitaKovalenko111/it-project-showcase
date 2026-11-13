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
  const rows = (name) => JSON.parse(memory.get('uust_showcase_v2_' + name))
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
    teams: 25,
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
  const serialized = memory.get('uust_showcase_v2_cases')
  new MockServer()
  assert.equal(memory.get('uust_showcase_v2_cases'), serialized)
})
