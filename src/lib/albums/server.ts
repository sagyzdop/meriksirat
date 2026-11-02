import { resolveSession } from '@/lib/auth/resolve-session'
import { db } from '@/db'
import { albumMember, user } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import type { AlbumAccessLevel, AlbumFolderState } from './types'
import type { DriveFileMeta } from '@/lib/google/google-drive'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'user' | 'manager' | 'admin'
  clearanceLevel: number
}

/**
 * Resolve the current authenticated user (any role) from the request headers.
 * Returns null when there is no valid session.
 */
export async function getSessionUser(
  headers: Headers
): Promise<SessionUser | null> {
  const session = await resolveSession(headers)
  if (!session?.user) return null

  const su = session.user as {
    id: string
    email: string
    name: string
    role?: string
    clearanceLevel?: number
  }

  if (su.role !== undefined && su.clearanceLevel !== undefined) {
    return {
      id: su.id,
      email: su.email ?? '',
      name: su.name ?? su.email ?? 'Unknown',
      role: (su.role as SessionUser['role']) ?? 'user',
      clearanceLevel: su.clearanceLevel,
    }
  }

  const { env } = await import('cloudflare:workers')
  const database = db(env.meriksirat_d1 as D1Database)
  const dbUser = await database
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clearanceLevel: user.clearanceLevel,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get()

  if (!dbUser) return null

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: (dbUser.role as SessionUser['role']) ?? 'user',
    clearanceLevel: dbUser.clearanceLevel ?? 1,
  }
}

export function isManagerRole(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

export interface AlbumRow {
  id: string
  ownerUserId: string
}

/**
 * Resolve the acting user's access level for a given album row.
 * manager > owner > editor > none.
 */
export async function resolveAlbumAccess(
  headers: Headers,
  albumRow: AlbumRow
): Promise<{ user: SessionUser | null; access: AlbumAccessLevel }> {
  const user = await getSessionUser(headers)
  if (!user) return { user, access: 'none' }
  if (isManagerRole(user)) return { user, access: 'manager' }
  if (albumRow.ownerUserId === user.id) return { user, access: 'owner' }

  const { env } = await import('cloudflare:workers')
  const database = db(env.meriksirat_d1 as D1Database)
  const membership = await database
    .select({ id: albumMember.id })
    .from(albumMember)
    .where(
      and(eq(albumMember.albumId, albumRow.id), eq(albumMember.userId, user.id))
    )
    .get()

  return membership ? { user, access: 'editor' } : { user, access: 'none' }
}

export function requireAccess(
  access: AlbumAccessLevel,
  allowed: AlbumAccessLevel[]
): void {
  if (!allowed.includes(access)) {
    throw new Error('Insufficient permissions')
  }
}

// ---------------------------------------------------------------------------
// Folder listing cache
//
// Public album views hit the Drive API once per page load. To protect the
// master account's Drive API quota on shared links we cache the folder listing
// in KV for ~5m. Uploads invalidate the cache right away.
// ---------------------------------------------------------------------------

const LISTING_TTL_SECONDS = 300

export interface CachedListing {
  folderState: AlbumFolderState
  files: DriveFileMeta[]
}

function listingKey(folderId: string): string {
  return `album:list:${folderId}`
}

export async function getCachedListing(
  folderId: string
): Promise<CachedListing | null> {
  try {
    const { env } = await import('cloudflare:workers')
    const raw = await (env.meriksirat_kv as KVNamespace).get(
      listingKey(folderId)
    )
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return null // pre-folderState cache shape
    if (typeof parsed !== 'object' || parsed === null) return null
    const { folderState, files } = parsed as Partial<CachedListing>
    if (
      folderState !== 'ok' &&
      folderState !== 'trashed' &&
      folderState !== 'missing'
    ) {
      return null
    }
    if (!Array.isArray(files)) return null
    return { folderState, files }
  } catch (error) {
    console.warn('Failed to read album listing cache:', error)
    return null
  }
}

export async function setCachedListing(
  folderId: string,
  files: DriveFileMeta[],
  folderState: AlbumFolderState = 'ok'
): Promise<void> {
  try {
    const { env } = await import('cloudflare:workers')
    await (env.meriksirat_kv as KVNamespace).put(
      listingKey(folderId),
      JSON.stringify({ files, folderState }),
      {
        expirationTtl: LISTING_TTL_SECONDS,
      }
    )
  } catch (error) {
    console.warn('Failed to write album listing cache:', error)
  }
}

export async function invalidateCachedListing(folderId: string): Promise<void> {
  try {
    const { env } = await import('cloudflare:workers')
    await (env.meriksirat_kv as KVNamespace).delete(listingKey(folderId))
  } catch (error) {
    console.warn('Failed to invalidate album listing cache:', error)
  }
}

// ---------------------------------------------------------------------------
// In-isolate memo layer
//
// KV free tier allows only 1,000 writes/day, so hot payloads must not hit KV
// on every rebuild. A tiny per-isolate Map absorbs repeat traffic: warm
// isolates serve everything from RAM and only cold/expired reads touch KV.
// Entries are viewer-independent payloads (album cores / public pages) so
// sharing them across requests within an isolate is safe. Bounded to keep
// isolate memory usage predictable.
// ---------------------------------------------------------------------------

const MEM_TTL_MS = 30_000
const MEM_MAX_ENTRIES = 25

const memStore = new Map<string, { value: string; expiresAt: number }>()

function memGet(key: string): string | null {
  const hit = memStore.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    memStore.delete(key)
    return null
  }
  return hit.value
}

function memSet(key: string, value: string): void {
  if (!memStore.has(key) && memStore.size >= MEM_MAX_ENTRIES) {
    const oldest = memStore.keys().next().value
    if (oldest !== undefined) memStore.delete(oldest)
  }
  memStore.set(key, { value, expiresAt: Date.now() + MEM_TTL_MS })
}

function memoKvCache(ttlSeconds: number, label: string) {
  return {
    async get(key: string): Promise<unknown | null> {
      const fromMem = memGet(key)
      if (fromMem !== null) return parseCached(fromMem)
      try {
        const { env } = await import('cloudflare:workers')
        const raw = await (env.meriksirat_kv as KVNamespace).get(key)
        if (!raw) return null
        memSet(key, raw)
        return parseCached(raw)
      } catch (error) {
        console.warn(`Failed to read ${label} cache:`, error)
        return null
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      const raw = JSON.stringify(value)
      memSet(key, raw)
      try {
        const { env } = await import('cloudflare:workers')
        await (env.meriksirat_kv as KVNamespace).put(key, raw, {
          expirationTtl: ttlSeconds,
        })
      } catch (error) {
        console.warn(`Failed to write ${label} cache:`, error)
      }
    },
  }
}

function parseCached(raw: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch {
    return null
  }
}

const detailCache = memoKvCache(3600, 'album detail')

function detailCoreKey(albumId: string): string {
  return `album:detail:${albumId}`
}

export function getCachedDetailCore(albumId: string): Promise<unknown | null> {
  return detailCache.get(detailCoreKey(albumId))
}

export function setCachedDetailCore(
  albumId: string,
  core: unknown
): Promise<void> {
  return detailCache.set(detailCoreKey(albumId), core)
}

export async function invalidateCachedDetailCore(
  albumId: string
): Promise<void> {
  memStore.delete(detailCoreKey(albumId))
  try {
    const { env } = await import('cloudflare:workers')
    await (env.meriksirat_kv as KVNamespace).delete(detailCoreKey(albumId))
  } catch (error) {
    console.warn('Failed to invalidate album detail cache:', error)
  }
}

const publicPageCache = memoKvCache(600, 'public album list')

function publicPageKey(query: unknown): string {
  const raw = JSON.stringify(query)
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0
  }
  return `album:publist:${(hash >>> 0).toString(36)}`
}

export function getCachedPublicPage(query: unknown): Promise<unknown | null> {
  return publicPageCache.get(publicPageKey(query))
}

export function setCachedPublicPage(
  query: unknown,
  page: unknown
): Promise<void> {
  return publicPageCache.set(publicPageKey(query), page)
}
