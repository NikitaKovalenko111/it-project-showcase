import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { createPortfolioApi } = await import(
  await loadTs(new URL('../src/api/portfolio.ts', import.meta.url))
)

test('own achievements reload from the server after recreating the API', async () => {
  const records = [
    { file_id: 'old', kind: 'certificate', original_name: 'Old.png' },
    { file_id: 'resume', kind: 'resume', original_name: 'CV.pdf' },
  ]
  const calls = []
  const http = {
    async get(path) {
      calls.push(['GET', path])
      return { data: { items: records } }
    },
    async post(path, body) {
      calls.push(['POST', path, body])
      records.push({ ...body, original_name: 'New.png' })
    },
  }
  await createPortfolioApi(http).add([{ file_id: 'new', name: 'New.png', url: '/uploaded' }])
  const files = await createPortfolioApi(http).list('student', true)
  assert.deepEqual(
    files.map((f) => f.file_id),
    ['old', 'new'],
  )
  assert.equal(files[1].url, '/api/v1/files/new')
  assert.equal(calls.at(-1)[1], '/portfolio/me/files')
  assert.equal(records.find((f) => f.file_id === 'resume').kind, 'resume')
})

test('visitor gets public portfolio URLs and removal targets only one attachment', async () => {
  const calls = []
  const api = createPortfolioApi({
    async get(path) {
      calls.push(path)
      return { data: { items: [{ file_id: 'f', kind: 'certificate', original_name: 'Cert.pdf' }] } }
    },
    async delete(path) {
      calls.push(path)
    },
  })
  assert.equal(
    (await api.list('student', false))[0].url,
    '/api/v1/students/student/portfolio/files/f',
  )
  await api.remove('f')
  assert.deepEqual(calls, ['/students/student/portfolio/files', '/portfolio/me/files/f'])
})

test('failed attachment mutations propagate rather than showing unsaved achievements', async () => {
  const api = createPortfolioApi({
    post: async () => {
      throw new Error('Upload rejected')
    },
  })
  await assert.rejects(() => api.add([{ name: 'x', url: '' }]), /не загружен/)
  await assert.rejects(() => api.add([{ name: 'x', url: '', file_id: 'id' }]), /Upload rejected/)
})
