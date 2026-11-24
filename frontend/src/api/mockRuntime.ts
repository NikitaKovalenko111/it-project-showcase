import type { MockServer } from './mockServer'

let createServer: (() => MockServer) | undefined
let server: MockServer | undefined
let opportunityFixtures: typeof import('./fixtures/programs') | undefined

export async function loadMockRuntime() {
  const [implementation, fixtures] = await Promise.all([
    import('./mockServer'),
    import('./fixtures/programs'),
  ])
  createServer = implementation.createMockServer
  opportunityFixtures = fixtures
}

export const mockServer = new Proxy({} as MockServer, {
  get(_target, key) {
    if (!createServer) throw new Error('Режим мок-данных не включён.')
    server ??= createServer()
    return Reflect.get(server, key)
  },
})

export function mockOpportunityFixtures() {
  if (!opportunityFixtures) throw new Error('Режим мок-данных не включён.')
  return opportunityFixtures
}
