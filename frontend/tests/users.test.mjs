import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { createUserManagement } = await import(
  await loadTs(new URL('../src/api/users.ts', import.meta.url))
)

test('role mutation translates UI roles and reloads the server user after 204', async () => {
  for (const [role, serverRole] of [
    ['student', 'student'],
    ['company', 'company_representative'],
    ['curator', 'university_staff'],
  ]) {
    const calls = []
    const api = createUserManagement({
      async patch(path, body) {
        calls.push([path, body])
        return { status: 204 }
      },
      async get(path) {
        assert.equal(path, '/users')
        return {
          data: { items: [{ user_id: 'u', roles: [serverRole], username: 'person' }], total: 1 },
        }
      },
    })
    assert.equal((await api.changeRole('u', role)).role, role)
    assert.deepEqual(calls, [['/users/u/role', { role: serverRole }]])
  }
})

test('unsupported roles never produce an API request and server conflicts propagate', async () => {
  const api = createUserManagement({
    patch() {
      throw new Error('role_change_conflict')
    },
  })
  await assert.rejects(() => api.changeRole('u', 'admin'), /Выберите роль/)
  await assert.rejects(() => api.changeRole('u', 'company'), /role_change_conflict/)
})
