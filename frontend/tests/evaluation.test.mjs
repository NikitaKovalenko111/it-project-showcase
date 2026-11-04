import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { evaluationTotal } = await import(await loadTs(new URL('../src/utils/evaluation.ts', import.meta.url)))
test('weighted criteria preserve count-based maximum and clamp scores', () => {
  const criteria = [{id:'a',weight:3},{id:'b',weight:1}]
  assert.equal(evaluationTotal(criteria, {a:10,b:10}), 20)
  assert.equal(evaluationTotal(criteria, {a:10,b:0}), 15)
  assert.equal(evaluationTotal(criteria, {a:0,b:10}), 5)
  assert.equal(evaluationTotal(criteria, {a:20,b:-1}), 15)
  assert.equal(evaluationTotal([], {}), 0)
})
