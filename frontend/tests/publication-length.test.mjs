import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { shorteningError } = await import(
  await loadTs(new URL('../src/utils/publicationLength.ts', import.meta.url))
)

test('case summary allows the same Unicode character count as the API', () => {
  const summary = 'а😀'.repeat(500)
  assert.equal(shorteningError('краткое описание', summary, 1000), '')
  assert.match(shorteningError('краткое описание', summary + 'я', 1000), /1\s000 символов/)
})

test('internship error reports how many characters fit the API byte limit', () => {
  assert.equal(shorteningError('описание', ' ASCIIя😀 ', 11, 'utf8'), '')
  assert.equal(
    shorteningError('описание', 'ASCIIя😀б', 11, 'utf8'),
    'Сократите описание до 7 символов.',
  )
  assert.equal(
    shorteningError('описание', 'абв😀г', 9, 'utf8'),
    'Сократите описание до 3 символов.',
  )
})
