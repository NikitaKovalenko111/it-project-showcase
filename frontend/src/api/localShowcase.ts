type LocalCompany = { name: string; cover: string }

let companies: Record<string, LocalCompany> = {}
let representatives: Record<string, string> = {}

export async function loadLocalShowcase() {
  try {
    const response = await fetch('/showcase-media/catalog.json', { signal: AbortSignal.timeout(1500) })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return
    const catalog = await response.json()
    companies = catalog.companies ?? {}
    representatives = catalog.representatives ?? {}
  } catch {
    // A regular deployment does not have a local demo catalog.
  }
}

export const localCompany = (id: string) => companies[id]
export const localRepresentative = (id: string) => representatives[id]
