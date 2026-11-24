import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { getRepresentativeProfile, saveRepresentativeProfile, getCompanyMentors, setCompanyMentor } =
  await import(await loadTs(new URL('../src/utils/representativeProfile.ts', import.meta.url)))

test('profiles appear only in the chosen company and reflect personal edits', () => {
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  const original = {
    name: ' Анна ',
    position: ' Аналитик ',
    bio: ' Опыт в ИТ ',
    expertise: ' SQL ',
  }
  saveRepresentativeProfile('anna', original)
  saveRepresentativeProfile('pavel', { ...original, name: 'Павел' })
  assert.equal(getRepresentativeProfile('anna').name, 'Анна')
  assert.deepEqual(getCompanyMentors('team'), [])
  setCompanyMentor('team', 'anna', true)
  setCompanyMentor('team', 'anna', true)
  assert.deepEqual(
    getCompanyMentors('team').map(({ id }) => id),
    ['anna'],
  )
  assert.deepEqual(getCompanyMentors('other-team'), [])
  saveRepresentativeProfile('anna', { ...original, bio: 'Консультирую по тестированию' })
  assert.equal(getCompanyMentors('team')[0].bio, 'Консультирую по тестированию')
  setCompanyMentor('team', 'anna', false)
  assert.deepEqual(getCompanyMentors('team'), [])
  assert.equal(getRepresentativeProfile('anna').position, 'Аналитик')
})
