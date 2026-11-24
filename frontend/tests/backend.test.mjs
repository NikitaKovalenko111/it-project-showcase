import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { toCase, fromCase, fromCompany, fromProject, fromUser, collectPages } = await import(
  await loadTs(new URL('../src/api/backend.ts', import.meta.url))
)
test('case cards use the same backend logo as the company directory', () => {
  const company = fromCompany({ company_id: 'co', logo_file_id: 'logo' })
  const project = fromCase({ case_id: 'c', company_id: 'co', company_logo_file_id: 'logo' })
  assert.equal(company.logo, '/api/v1/companies/co/logo?v=logo')
  assert.equal(project.companyLogo, company.logo)
  assert.equal(fromCase({ case_id: 'c2', company_id: 'co' }).companyLogo, '')
})

test('student project details carry the author name from the project payload', () => {
  const project = fromProject({ project_id: 'p', owner_id: 'u', owner_name: 'Гарифуллина Алина' })
  assert.equal(project.authorId, 'u')
  assert.equal(project.authorName, 'Гарифуллина Алина')
})

test('backend DTO maps criterion maximum, auth roles and dates', () => {
  const project = fromCase({
    case_id: 'c',
    company_id: 'co',
    title: 'Example',
    summary: 'Short',
    full_brief: 'Brief',
    work_format: 'remote',
    participation_mode: 'team',
    status: 'published',
    due_at: '2027-01-02T12:00:00Z',
    evaluation_criteria: [{ criterion_id: 'q', name: 'Quality', max_score: 25 }],
    type: 'contest',
  })
  assert.equal(project.deadlineDate, '2027-01-02')
  assert.equal(project.status, 'open')
  const dto = toCase(project)
  assert.deepEqual(dto.evaluation_criteria, [{ name: 'Quality', max_score: 25, ordinal: 1 }])
  assert.equal(dto.company_id, 'co')
  assert.equal(dto.work_format, 'remote')
  assert.equal(dto.due_at, '2027-01-02T12:00:00Z')
  assert.ok(!('weight' in dto.evaluation_criteria[0]))
  assert.equal(
    fromUser({ user_id: 'u', roles: ['student', 'admin'], username: 'a', status: 'blocked' }).role,
    'admin',
  )
})
test('new case deadlines end on the selected local calendar day', () => {
  const project = fromCase({ case_id: 'local-deadline' })
  project.deadlineDate = '2027-01-02'
  const deadline = new Date(toCase(project).due_at)
  assert.deepEqual(
    [
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate(),
      deadline.getHours(),
      deadline.getMinutes(),
      deadline.getSeconds(),
    ],
    [2027, 0, 2, 23, 59, 59],
  )
})
test('cursor lists collect every page and reject repeated cursor', async () => {
  let calls = 0
  const items = await collectPages(async (params) => ({
    data:
      ++calls === 1
        ? { items: [1], meta: { has_more: true, next_cursor: 'next' } }
        : { items: [2], meta: { has_more: false } },
  }))
  assert.deepEqual(items, [1, 2])
  assert.equal(calls, 2)
  await assert.rejects(
    () =>
      collectPages(async () => ({
        data: { items: [], meta: { has_more: true, next_cursor: 'same' } },
      })),
    /курсор/,
  )
})
const { evaluationTotal } = await import(
  await loadTs(new URL('../src/utils/evaluation.ts', import.meta.url))
)
test('new criteria sum individual maxima without weights', () => {
  assert.equal(
    evaluationTotal(
      [
        { id: 'a', maxScore: 25, weight: 100 },
        { id: 'b', maxScore: 5, weight: 1 },
      ],
      { a: 100, b: 3 },
    ),
    28,
  )
})

test('server roles and moderation map without exposing unpublished cases', () => {
  assert.equal(fromUser({ roles: ['company_representative'], user_id: 'co' }).role, 'company')
  assert.equal(fromUser({ roles: ['university_staff'], user_id: 'staff' }).role, 'curator')
  const draft = fromCase({ case_id: 'draft', status: 'draft', evaluation_criteria: [] })
  assert.equal(draft.isModerated, false)
  assert.equal(draft.moderationStatus, 'pending')
})
const { collectNumbered } = await import(
  await loadTs(new URL('../src/api/backend.ts', import.meta.url))
)
test('page lists collect more than one hundred items', async () => {
  const rows = await collectNumbered(async ({ page }) => ({
    data: {
      items: page === 1 ? Array.from({ length: 100 }, (_, i) => i) : [100],
      meta: { total: 101 },
    },
  }))
  assert.equal(rows.length, 101)
  assert.equal(rows[100], 100)
})
const { formatDate } = await import(await loadTs(new URL('../src/utils/date.ts', import.meta.url)))
test('nullable server deadlines do not display Invalid Date', () => {
  assert.equal(formatDate(null), 'Не указан')
  assert.equal(formatDate('invalid'), 'Не указан')
})

test('current backend cursor response fetches subsequent pages', async () => {
  const cursors = []
  const result = await collectPages(async ({ cursor }) => {
    cursors.push(cursor)
    return {
      data: cursor ? { items: [2], next_cursor: null } : { items: [1], next_cursor: 'next' },
    }
  })
  assert.deepEqual(result, [1, 2])
  assert.deepEqual(cursors, [undefined, 'next'])
})

test('shared avatar takes precedence over legacy student photo', () => {
  assert.equal(
    fromUser({ user_id: 'u', avatar_file_id: 'avatar', student: { photo_file_id: 'old' } }).avatar,
    '/api/v1/users/u/avatar?v=avatar',
  )
  assert.equal(
    fromUser({ user_id: 'u', student: { photo_file_id: 'old' } }).avatar,
    '/api/v1/users/u/avatar?v=old',
  )
})
