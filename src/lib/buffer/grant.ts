import { eq, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { bufferGrant, volume } from '@/db/schema'
import { decryptToken, encryptToken } from './crypto'
import { DEFAULT_BUFFER_EMAIL, planBufferSource, type BufferPlan } from './plan'
import { canRetire, type BufferState } from './grant-rules'

export type BufferGrantRow = typeof bufferGrant.$inferSelect

export const ENV_GRANT_ID = 'env'

export interface ResolvedBufferGrant {
  id: string
  email: string
  refreshToken: string
  status: 'active' | 'pending' | 'retiring'
}

const ROW_TTL_MS = 30 * 1000

let rowCache: { at: number; rows: BufferGrantRow[] } | null = null

async function workerDatabase(): Promise<Database> {
  const { env } = await import('cloudflare:workers')
  return db(env.meriksirat_d1 as D1Database)
}

export function forgetBufferGrantRows(): void {
  rowCache = null
}

export async function listBufferGrants(
  database?: Database
): Promise<BufferGrantRow[]> {
  if (rowCache && Date.now() - rowCache.at < ROW_TTL_MS) return rowCache.rows
  const rows = await (database ?? (await workerDatabase()))
    .select()
    .from(bufferGrant)
    .all()
  rowCache = { at: Date.now(), rows }
  return rows
}

export function peekActiveGrantId(): string {
  return rowCache?.rows.find((r) => r.status === 'active')?.id ?? ENV_GRANT_ID
}

export function legacyBufferEmail(): string {
  return process.env.GOOGLE_BUFFER_EMAIL?.trim() || DEFAULT_BUFFER_EMAIL
}

function envRefreshToken(): string | null {
  return (
    process.env.GOOGLE_BUFFER_FULL_REFRESH_TOKEN?.trim() ||
    process.env.GOOGLE_BUFFER_REFRESH_TOKEN?.trim() ||
    null
  )
}

export async function bufferEmails(database?: Database): Promise<string[]> {
  const rows = await listBufferGrants(database)
  return [legacyBufferEmail(), ...rows.map((r) => r.email)]
}

export async function resolveBufferGrant(
  grantId?: string | null,
  database?: Database
): Promise<ResolvedBufferGrant | null> {
  const rows = await listBufferGrants(database)
  const row = grantId
    ? rows.find((r) => r.id === grantId)
    : rows.find((r) => r.status === 'active')
  if (row) {
    const secret = process.env.BUFFER_ENCRYPTION_KEY ?? ''
    return {
      id: row.id,
      email: row.email,
      refreshToken: await decryptToken(row.refreshToken, secret),
      status: row.status,
    }
  }
  if (grantId && grantId !== ENV_GRANT_ID) return null
  if (!grantId && rows.some((r) => r.status === 'active')) return null
  const token = envRefreshToken()
  if (!token) return null
  return {
    id: ENV_GRANT_ID,
    email: legacyBufferEmail(),
    refreshToken: token,
    status: 'active',
  }
}

export async function activeBufferEmail(
  database?: Database
): Promise<string | null> {
  const rows = await listBufferGrants(database)
  const active = rows.find((r) => r.status === 'active')
  if (active) return active.email
  return envRefreshToken() ? legacyBufferEmail() : null
}

/** The grant id new volumes record; null while the env tokens are in use. */
export async function activeBufferGrantId(
  database?: Database
): Promise<string | null> {
  const rows = await listBufferGrants(database)
  return rows.find((r) => r.status === 'active')?.id ?? null
}

export async function storeBufferGrant(
  database: Database,
  input: {
    id: string
    email: string
    refreshToken: string
    scopes: string
    status: 'active' | 'pending'
  }
): Promise<void> {
  const encrypted = await encryptToken(
    input.refreshToken,
    process.env.BUFFER_ENCRYPTION_KEY ?? ''
  )
  await database.insert(bufferGrant).values({
    id: input.id,
    email: input.email,
    refreshToken: encrypted,
    scopes: input.scopes,
    status: input.status,
  })
  forgetBufferGrantRows()
}

export async function replaceBufferGrantToken(
  database: Database,
  id: string,
  refreshToken: string,
  scopes: string
): Promise<void> {
  const encrypted = await encryptToken(
    refreshToken,
    process.env.BUFFER_ENCRYPTION_KEY ?? ''
  )
  await database
    .update(bufferGrant)
    .set({
      refreshToken: encrypted,
      scopes,
      state: 'ok',
      stateChangedAt: new Date(),
      alertedState: null,
    })
    .where(eq(bufferGrant.id, id))
  forgetBufferGrantRows()
}

export async function clearState(
  grantId: string,
  from: BufferState
): Promise<void> {
  const rows = await listBufferGrants()
  if (rows.find((r) => r.id === grantId)?.state === from) {
    await setBufferGrantState(grantId, 'ok')
  }
}

export async function setBufferGrantState(
  grantId: string,
  state: BufferState,
  database?: Database
): Promise<void> {
  if (grantId === ENV_GRANT_ID) return
  const conn = database ?? (await workerDatabase())
  const rows = await listBufferGrants(conn)
  const current = rows.find((r) => r.id === grantId)
  if (!current || current.state === state) return
  await conn
    .update(bufferGrant)
    .set({
      state,
      stateChangedAt: new Date(),
      ...(state === 'ok' ? { alertedState: null } : {}),
    })
    .where(eq(bufferGrant.id, grantId))
  forgetBufferGrantRows()
}

/** Drops retiring grants nobody references once their rollback window passed. */
export async function retireBufferGrants(
  database: Database,
  now: Date = new Date()
): Promise<number> {
  const retiring = await database
    .select()
    .from(bufferGrant)
    .where(eq(bufferGrant.status, 'retiring'))
    .all()
  let removed = 0
  for (const grant of retiring) {
    const refs = await database
      .select({ n: sql<number>`count(*)` })
      .from(volume)
      .where(eq(volume.bufferGrantId, grant.id))
      .get()
    if (!canRetire(grant, refs?.n ?? 0, now)) continue
    await database.delete(bufferGrant).where(eq(bufferGrant.id, grant.id))
    removed++
  }
  if (removed > 0) forgetBufferGrantRows()
  return removed
}

/** Cancels a switch: staged copies stay dropped and are cleaned with this grant. */
export async function cancelPendingGrant(
  database: Database,
  now: Date = new Date()
): Promise<void> {
  await database
    .update(bufferGrant)
    .set({ status: 'retiring', retireAfter: now })
    .where(eq(bufferGrant.status, 'pending'))
  forgetBufferGrantRows()
}

export async function getBufferPlan(database?: Database): Promise<BufferPlan> {
  const rows = await listBufferGrants(database)
  const active = rows.find((r) => r.status === 'active') ?? null
  return planBufferSource({ env: process.env, active })
}
