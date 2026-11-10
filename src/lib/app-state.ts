import { asc, eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { appState } from '@/db/schema'

// D1 caps a row at 2 MB. A UTF-16 unit is at most 3 bytes of UTF-8, so a part
// of this many units always fits.
export const STATE_PART_CHARS = 500_000

export function splitStateValue(
  value: string,
  size = STATE_PART_CHARS
): string[] {
  const parts: string[] = []
  for (let i = 0; i < value.length; i += size) {
    parts.push(value.slice(i, i + size))
  }
  return parts.length > 0 ? parts : ['']
}

export function joinStateParts(
  rows: { value: string; expiresAt: Date | null }[],
  now: Date
): string | null {
  if (rows.length === 0) return null
  if (rows.some((row) => row.expiresAt && row.expiresAt <= now)) return null
  return rows.map((row) => row.value).join('')
}

async function database() {
  const { env } = await import('cloudflare:workers')
  return db(env.meriksirat_d1 as D1Database)
}

export async function readState(key: string): Promise<string | null> {
  const rows = await (
    await database()
  )
    .select({ value: appState.value, expiresAt: appState.expiresAt })
    .from(appState)
    .where(eq(appState.key, key))
    .orderBy(asc(appState.part))
  return joinStateParts(rows, new Date())
}

export async function writeState(
  key: string,
  value: string,
  ttlSeconds: number | null
): Promise<void> {
  const store = await database()
  const now = new Date()
  const expiresAt =
    ttlSeconds === null ? null : new Date(now.getTime() + ttlSeconds * 1000)
  const [first, ...rest] = splitStateValue(value).map((part, index) =>
    store.insert(appState).values({ key, part: index, value: part, expiresAt })
  )
  await store.batch([
    store.delete(appState).where(lt(appState.expiresAt, now)),
    store.delete(appState).where(eq(appState.key, key)),
    first,
    ...rest,
  ])
}

export async function deleteState(key: string): Promise<void> {
  await (await database()).delete(appState).where(eq(appState.key, key))
}
