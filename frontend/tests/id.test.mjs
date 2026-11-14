import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { createId } = await import(await loadTs(new URL('../src/utils/id.ts', import.meta.url)))
const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
const setCrypto = (value) =>
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value })
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'crypto', original)
  else delete globalThis.crypto
})
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('uses native UUID generation with the correct receiver when available', () => {
  const provider = {
    randomUUID() {
      assert.equal(this, provider)
      return 'native-id'
    },
  }
  setCrypto(provider)
  assert.equal(createId(), 'native-id')
})

test('generates valid UUID v4 identifiers over HTTP without crypto.randomUUID', () => {
  let calls = 0
  setCrypto({
    getRandomValues(bytes) {
      calls++
      return bytes.fill(255)
    },
  })
  assert.equal(createId(), 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  assert.equal(calls, 1)
})

test('generates unique record identifiers even when Web Crypto is unavailable', () => {
  setCrypto(undefined)
  const ids = Array.from({ length: 10000 }, createId)
  assert.equal(new Set(ids).size, ids.length)
  ids.forEach((id) => assert.match(id, uuid))
})
