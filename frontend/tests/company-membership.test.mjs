import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { createCompanyMembershipApi, withCompanyMemberships } = await import(
  await loadTs(new URL('../src/api/companyMembership.ts', import.meta.url))
)
const { createUserManagement } = await import(
  await loadTs(new URL('../src/api/users.ts', import.meta.url))
)
const { canCreatePublication } = await import(
  await loadTs(new URL('../src/utils/publicationAccess.ts', import.meta.url))
)
const { belongsToCompany } = await import(
  await loadTs(new URL('../src/utils/access.ts', import.meta.url))
)

test('representative account and role approval are separate from creating a company', async () => {
  const calls = []
  const userApi = createUserManagement({
    post: async (...request) => {
      calls.push(['POST', ...request])
      return { data: { user_id: 'representative' } }
    },
    patch: async (...request) => {
      calls.push(['PATCH', ...request])
      return { status: 204 }
    },
  })
  const userId = await userApi.requestRole({
    role: 'company',
    fullName: '  Анна Петрова  ',
    username: 'partner',
    email: 'partner@example.test',
    password: 'Example12345',
  })
  assert.equal(userId, 'representative')
  await userApi.reviewRole(userId, 'approved')
  assert.deepEqual(calls, [
    [
      'POST',
      '/auth/register',
      {
        role: 'company_representative',
        full_name: 'Анна Петрова',
        username: 'partner',
        email: 'partner@example.test',
        password: 'Example12345',
        consent_version: '1',
      },
    ],
    ['PATCH', '/users/representative/role-request', { status: 'approved' }],
  ])
})

test('representative profile sends only changed fields and preserves clearing and line breaks', async () => {
  const path = '/users/me/representative-profile'
  const calls = []
  const userApi = createUserManagement({
    get: async (...request) => {
      calls.push(request)
      return { data: { experience_and_interests: 'Опыт', help_topics: 'Go\nSQL' } }
    },
    patch: async (...request) => {
      calls.push(request)
      return { data: { experience_and_interests: '', help_topics: 'Go\nSQL' } }
    },
  })
  assert.deepEqual(await userApi.getRepresentativeProfile(), { bio: 'Опыт', expertise: 'Go\nSQL' })
  assert.deepEqual(await userApi.updateRepresentativeProfile({ bio: '' }), {
    bio: '',
    expertise: 'Go\nSQL',
  })
  assert.deepEqual(calls, [[path], [path, { experience_and_interests: '' }]])
})

test('company submission and invitation acceptance use distinct endpoints and return the company', async () => {
  const calls = []
  const record = { company_id: 'company', full_name: 'Команда', inn: '7707083893' }
  const api = createCompanyMembershipApi({
    post: async (...request) => {
      calls.push(['POST', ...request])
      return { data: { ...record, status: request[0] === '/companies' ? 'draft' : 'pending' } }
    },
    patch: async (...request) => {
      calls.push(['PATCH', ...request])
      return { data: { ...record, status: 'approved' } }
    },
  })
  const draft = { full_name: record.full_name, inn: record.inn }
  assert.equal((await api.save(draft)).status, 'draft')
  assert.equal((await api.submit('company')).isVerified, false)
  await api.invite('company', 'second-user', 'Менеджер')
  const joined = await api.respond('invitation', 'accepted')
  assert.equal(joined.id, 'company')
  assert.equal(joined.isVerified, true)
  assert.deepEqual(calls, [
    ['POST', '/companies', draft],
    ['POST', '/companies/company/submit-moderation'],
    [
      'POST',
      '/companies/company/member-invitations',
      { user_id: 'second-user', position: 'Менеджер' },
    ],
    ['PATCH', '/company-member-invitations/invitation', { status: 'accepted' }],
  ])
})

test('company logos use the dedicated multipart endpoint and reject unsupported files', async () => {
  const uploads = []
  const api = createCompanyMembershipApi({
    put: async (path, body) => {
      uploads.push({ path, body })
      return { data: { file_id: 'logo' } }
    },
  })
  await assert.rejects(
    api.uploadLogo(
      'company',
      new File(['data'], 'logo.svg', {
        type: 'image/svg+xml',
      }),
    ),
    /PNG, JPEG или WebP/,
  )
  await assert.rejects(
    api.uploadLogo(
      'company',
      new File([], 'empty.png', {
        type: 'image/png',
      }),
    ),
    /непустое изображение/,
  )

  const file = new File(['logo bytes'], 'logo.png', { type: 'image/png' })
  assert.equal(await api.uploadLogo('company', file), 'logo')
  assert.equal(uploads.length, 1)
  assert.equal(uploads[0].path, '/companies/company/logo')
  assert.ok(uploads[0].body instanceof FormData)
  const uploaded = uploads[0].body.get('file')
  assert.equal(uploaded.name, 'logo.png')
  assert.equal(uploaded.type, 'image/png')
  assert.equal(await uploaded.text(), 'logo bytes')
})

test('membership and invitation lists follow the cursor and preserve the selected company ID', async () => {
  const calls = []
  const api = createCompanyMembershipApi({
    get: async (path, { params }) => {
      calls.push([path, params])
      if (path === '/companies/mine')
        return {
          data: params.cursor
            ? {
                items: [
                  { company_id: 'approved', full_name: 'Совпадающее имя', status: 'approved' },
                ],
              }
            : {
                items: [{ company_id: 'pending', full_name: 'Совпадающее имя', status: 'pending' }],
                next_cursor: 'companies-next',
              },
        }
      return {
        data: params.cursor
          ? { items: [{ invitation_id: 'target', status: 'pending' }] }
          : { items: [], next_cursor: 'invitations-next' },
      }
    },
  })
  const companies = await api.listMine()
  assert.equal((await api.listInvitations())[0].invitation_id, 'target')
  assert.equal(calls[3][1].cursor, 'invitations-next')
  assert.equal(calls[3][1].status, 'pending')

  const user = { id: 'representative', role: 'company' }
  assert.equal(canCreatePublication(withCompanyMemberships(user, [])), false)
  const pending = withCompanyMemberships(user, companies, 'pending')
  assert.equal(pending.companyProfile.companyId, 'pending')
  assert.equal(canCreatePublication(pending), false)
  assert.equal(belongsToCompany(pending, 'approved'), true)
  assert.equal(belongsToCompany(pending, 'same-name-elsewhere'), false)
  const approved = withCompanyMemberships(user, companies, 'approved')
  assert.equal(approved.companyProfile.companyId, 'approved')
  assert.equal(canCreatePublication(approved), true)
})
