import assert from 'node:assert/strict'
import test from 'node:test'
import { fixtureId } from './fixture-id.mjs'

test('fixture UUIDs are stable, distinct and compatible with the invitation API', () => {
  const student = 'syn_student_001'
  const team = 'syn_team_001'
  const supported = /^[a-f\d]{12}5[a-f\d]{3}[89ab][a-f\d]{15}$/
  assert.equal(fixtureId(student), '64ca835aa8595ccd88644cc6b437fc02')
  assert.match(fixtureId(student), supported)
  assert.match(fixtureId(team), supported)
  assert.notEqual(fixtureId(student), fixtureId(team))
  assert.equal(fixtureId(undefined), null)
})
