let sequence = 0

// Record identifiers only; do not use this helper for passwords or access tokens.
export function createId(): string {
  const provider = globalThis.crypto
  if (typeof provider?.randomUUID === 'function') return provider.randomUUID()

  const bytes = new Uint8Array(16)
  // getRandomValues is available over HTTP even when randomUUID is not.
  if (typeof provider?.getRandomValues === 'function') {
    provider.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = Math.floor(Math.random() * 256)
    const counter = ++sequence
    for (let index = 0; index < 4; index++) bytes[12 + index] ^= (counter >>> (index * 8)) & 255
  }
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
