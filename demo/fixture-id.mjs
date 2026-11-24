import { createHash } from 'node:crypto'

const namespace = '6ba7b8119dad11d180b400c04fd430c8'
const prefix = 'showcase-data:'

export function fixtureId(key) {
  if (!key) return null
  const bytes = createHash('sha1')
    .update(Buffer.from(namespace, 'hex'))
    .update(prefix + key)
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytes.toString('hex')
}

export const fixtureUuidSql = `CREATE OR REPLACE FUNCTION pg_temp.demo_uuid(seed text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (substr(hex, 1, 12) || '5' || substr(hex, 14, 3) ||
    substr('89ab', (strpos('0123456789abcdef', substr(hex, 17, 1)) - 1) % 4 + 1, 1) ||
    substr(hex, 18, 15))::uuid
  FROM (SELECT encode(public.digest(decode('${namespace}', 'hex') || convert_to('${prefix}' || seed, 'UTF8'), 'sha1'), 'hex') AS hex) AS hashed
$$`
