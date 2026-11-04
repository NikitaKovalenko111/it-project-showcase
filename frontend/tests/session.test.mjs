import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './load-ts.mjs'

const { rootReducer } = await import(await loadTs(new URL('../src/store/reducers/rootReducer.ts', import.meta.url)))

test('saved profile updates both the signed-in user and student directory', () => {
  const original = { id: 'student', role: 'student', studentProfile: { bio: 'before', techStack: ['JS'] } }
  let state = rootReducer(undefined, { type: 'auth/LOGIN_SUCCESS', payload: { user: original } })
  state = rootReducer(state, { type: 'students/FETCH_STUDENTS_SUCCESS', payload: { students: [original] } })
  const updated = { ...original, studentProfile: { bio: 'after', techStack: ['TypeScript'] } }
  state = rootReducer(state, { type: 'auth/UPDATE_USER_PROFILE_SUCCESS', payload: { user: updated } })
  assert.deepEqual(state.auth.currentUser.studentProfile, updated.studentProfile)
  assert.deepEqual(state.students.studentsList[0].studentProfile, updated.studentProfile)
})
test('changing profile clears old account data, filters and active workspace', () => {
  let state = rootReducer(undefined, { type: 'init' })
  state = rootReducer(state, { type: 'cases/FETCH_CASES_SUCCESS', payload: { cases: [{ id: 'old' }] } })
  state = rootReducer(state, { type: 'applications/FETCH_APPLICATIONS_SUCCESS', payload: { applications: [{ id: 'private' }] } })
  state = rootReducer(state, { type: 'cases/SET_CASE_FILTERS', payload: { filters: { search: 'old search' } } })
  const user = { id: 'new', role: 'company' }
  state = rootReducer(state, { type: 'auth/SWITCH_USER_SUCCESS', payload: { user } })
  assert.equal(state.auth.currentUser.id, 'new')
  assert.deepEqual(state.cases.casesList, [])
  assert.deepEqual(state.applications.applicationsList, [])
  assert.equal(state.cases.filters.search, '')
  assert.equal(state.cases.activeCase, null)
  state = rootReducer(state, { type: 'auth/LOGOUT_SUCCESS' })
  assert.equal(state.auth.currentUser, null)
})
