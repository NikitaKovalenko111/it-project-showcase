import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/showcase.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { selectShowcaseCases } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const options = { period: 'all', technology: 'all', recruiting: false, sort: 'newest' }
const makeCase = (id, publishedAt, extra = {}) => ({
  id, publishedAt, deadlineDate: '2027-05-01', applicationsCount: 0,
  requiredCompetencies: [], recommendedTech: [], direction: 'Frontend', status: 'open', ...extra,
})
const cases = [
  makeCase('old', '2026-08-31'),
  makeCase('autumn', '2026-09-01', { recommendedTech: ['React'], applicationsCount: 4 }),
  makeCase('winter', '2027-01-31', { status: 'completed', deadlineDate: '2027-02-10' }),
  makeCase('spring', '2027-02-01'),
  makeCase('summer', '2027-08-31'),
  makeCase('next', '2027-09-01'),
]
const select = (changes, today = new Date(2026, 9, 18)) =>
  selectShowcaseCases(cases, { ...options, ...changes }, today).map((c) => c.id)

test('academic semesters include their boundaries and exclude adjacent periods', () => {
  assert.deepEqual(select({ period: 'sem1' }), ['winter', 'autumn'])
  assert.deepEqual(select({ period: 'sem2' }), ['summer', 'spring'])
  assert.deepEqual(select({ period: 'year' }), ['summer', 'spring', 'winter', 'autumn'])
  assert.deepEqual(select({ period: 'sem1' }, new Date(2027, 0, 15)), ['winter', 'autumn'])
})
test('technology and recruiting filters combine with the chosen semester', () => {
  assert.deepEqual(select({ period: 'sem1', technology: 'react', recruiting: true }), ['autumn'])
  assert.deepEqual(select({ technology: 'missing' }), [])
  assert.ok(!select({ recruiting: true }).includes('winter'))
})
test('sorting respects deadline and application count without mutating source', () => {
  const original = cases.map((c) => c.id)
  assert.equal(select({ sort: 'deadline' })[0], 'winter')
  assert.equal(select({ sort: 'popular' })[0], 'autumn')
  assert.deepEqual(cases.map((c) => c.id), original)
  assert.deepEqual(selectShowcaseCases([], options), [])
})
