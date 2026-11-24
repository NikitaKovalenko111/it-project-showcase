import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { studentProjectCover } = await import(
  await loadTs(new URL('../src/utils/projectMedia.ts', import.meta.url))
)

test('private cover in cards uses the same protected route for owner and moderator', () => {
  const project = {
    id: 'p',
    authorId: 'owner',
    coverImage: '',
    server: { coverFileId: 'f', status: 'draft' },
  }
  assert.equal(studentProjectCover(project, { id: 'owner', role: 'student' }), '/api/v1/files/f')
  assert.equal(studentProjectCover(project, { id: 'admin', role: 'admin' }), '/api/v1/files/f')
  assert.equal(studentProjectCover(project, { id: 'other', role: 'student' }), '')
  assert.equal(
    studentProjectCover(
      { ...project, server: { ...project.server, status: 'moderation' } },
      { id: 'curator', role: 'curator' },
    ),
    '/api/v1/student-projects/p/review/files/f',
  )
})

test('published cover remains public and missing covers do not create broken image URLs', () => {
  assert.equal(studentProjectCover({ coverImage: '/public.jpg' }), '/public.jpg')
  assert.equal(studentProjectCover({ coverImage: '', server: {} }), '')
})
