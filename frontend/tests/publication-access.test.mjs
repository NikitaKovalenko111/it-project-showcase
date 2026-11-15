import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { canCreatePublication, canEditCaseDraft, canEditProgram } = await import(
  await loadTs(new URL('../src/utils/publicationAccess.ts', import.meta.url))
)
const admin = { id: 'admin', role: 'admin' }
const company = { id: 'rep', role: 'company', companyProfile: { companyId: 'co' } }

test('admin edits only own draft or revision, not another author or published content', () => {
  assert.equal(canCreatePublication(admin), true)
  for (const status of ['draft', 'revision']) {
    assert.equal(canEditCaseDraft(admin, { status, createdBy: 'admin' }), true)
    assert.equal(canEditProgram(admin, { status, created_by: 'admin', company_id: 'co' }), true)
  }
  assert.equal(canEditCaseDraft(admin, { status: 'draft', createdBy: 'other' }), false)
  assert.equal(canEditCaseDraft(admin, { status: 'open', createdBy: 'admin' }), false)
  assert.equal(
    canEditProgram(admin, { status: 'published', created_by: 'admin', company_id: 'co' }),
    false,
  )
  assert.equal(
    canEditProgram(admin, { status: 'draft', created_by: 'other', company_id: 'co' }),
    false,
  )
})

test('representatives retain ownership checks and observers cannot publish', () => {
  assert.equal(canEditCaseDraft(company, { status: 'draft', companyId: 'co' }), true)
  assert.equal(canEditCaseDraft(company, { status: 'draft', companyId: 'other' }), false)
  assert.equal(canEditProgram(company, { status: 'published', company_id: 'co' }), true)
  assert.equal(canCreatePublication({ id: 's', role: 'student' }), false)
  assert.equal(canCreatePublication({ id: 'c', role: 'curator' }), false)
})
