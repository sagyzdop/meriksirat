import { resolveSession } from '@/lib/auth/resolve-session'
import { db } from '@/db'
import { albumMember, user } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { deleteState, readState, writeState } from '@/lib/app-state'
import {
  LISTING_STORE_TTL_SECONDS,
  newerListingEntry,
  parseListingEntry,
} from './listing'
import type { AlbumListingEntry } from './listing'
import type { AlbumAccessLevel } from './types'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'user' | 'manager' | 'admin'
  clearanceLevel: number
}

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

function listingKey(folderId: string): string {
  return `album:list:${folderId}`
}

// Last entry this isolate wrote. When a write to the store fails, the next
// view still finds the fresh listing here instead of re-listing Drive.
const LISTING_MEMO_MAX = 50
const listingMemo = new Map<string, AlbumListingEntry>()

export function rememberListing(
  folderId: string,
  entry: AlbumListingEntry
): void {
  listingMemo.delete(folderId)
  if (listingMemo.size >= LISTING_MEMO_MAX) {
    const oldest = listingMemo.keys().next().value
    if (oldest !== undefined) listingMemo.delete(oldest)
  }
  listingMemo.set(folderId, entry)
}

export async function getCachedListing(
  folderId: string
): Promise<AlbumListingEntry | null> {
  const remembered = listingMemo.get(folderId) ?? null
  try {
    const raw = await readState(listingKey(folderId))
    return newerListingEntry(parseListingEntry(raw), remembered)
  } catch (error) {
    console.warn('Failed to read album listing cache:', error)
    return remembered
  }
}

export async function setCachedListing(
  folderId: string,
  entry: AlbumListingEntry
): Promise<void> {
  rememberListing(folderId, entry)
  try {
    await writeState(
      listingKey(folderId),
      JSON.stringify(entry),
      LISTING_STORE_TTL_SECONDS
    )
  } catch (error) {
    console.warn('Failed to write album listing cache:', error)
  }
}

export async function invalidateCachedListing(folderId: string): Promise<void> {
  listingMemo.delete(folderId)
  try {
    await deleteState(listingKey(folderId))
  } catch (error) {
    console.warn('Failed to invalidate album listing cache:', error)
  }
}

// The per-isolate memo absorbs repeat traffic for viewer-independent payloads
// before it reaches D1.
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

function memoStateCache(ttlSeconds: number, label: string) {
  return {
    async get(key: string): Promise<unknown | null> {
      const fromMem = memGet(key)
      if (fromMem !== null) return parseCached(fromMem)
      try {
        const raw = await readState(key)
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
        await writeState(key, raw, ttlSeconds)
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

// Every change to a core invalidates it explicitly, so the TTL only bounds how
// long an unnoticed change (such as a renamed author) can linger.
const detailCache = memoStateCache(6 * 3600, 'album detail')

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
    await deleteState(detailCoreKey(albumId))
  } catch (error) {
    console.warn('Failed to invalidate album detail cache:', error)
  }
}

// The public list is viewer-independent and only needs to be roughly fresh, so
// it lives in the edge Cache API, which has no write quota, instead of KV.
const PUBLIC_PAGE_TTL_SECONDS = 600

function edgeCache() {
  const cacheUrl = (key: string) => `https://cache.internal/${key}`
  const store = () => (caches as unknown as { default: Cache }).default
  return {
    async get(key: string): Promise<unknown | null> {
      const fromMem = memGet(key)
      if (fromMem !== null) return parseCached(fromMem)
      try {
        const hit = await store().match(cacheUrl(key))
        if (!hit) return null
        const raw = await hit.text()
        memSet(key, raw)
        return parseCached(raw)
      } catch (error) {
        console.warn('Failed to read public album list cache:', error)
        return null
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      const raw = JSON.stringify(value)
      memSet(key, raw)
      try {
        await store().put(
          cacheUrl(key),
          new Response(raw, {
            headers: {
              'cache-control': `public, max-age=${PUBLIC_PAGE_TTL_SECONDS}`,
            },
          })
        )
      } catch (error) {
        console.warn('Failed to write public album list cache:', error)
      }
    },
  }
}

const publicPageCache = edgeCache()

// The Cache API is per data center and its keys are hashes, so a change can't
// purge cached pages everywhere. Instead every key carries a version stored in
// KV; bumping it orphans all cached pages at once. Readers memo the version
// briefly, so a change shows everywhere within about a minute.
const PUBLIC_LIST_VERSION_KEY = 'album:publist:version'
const PUBLIC_LIST_VERSION_MEMO_MS = 15_000
const PUBLIC_LIST_VERSION_KV_TTL_SECONDS = 30

let publicListVersionMemo: { value: string; at: number } | null = null

async function publicListVersion(): Promise<string> {
  const memo = publicListVersionMemo
  if (memo && Date.now() - memo.at < PUBLIC_LIST_VERSION_MEMO_MS) {
    return memo.value
  }
  try {
    const { env } = await import('cloudflare:workers')
    const value =
      (await (env.meriksirat_kv as KVNamespace).get(PUBLIC_LIST_VERSION_KEY, {
        cacheTtl: PUBLIC_LIST_VERSION_KV_TTL_SECONDS,
      })) ?? '0'
    publicListVersionMemo = { value, at: Date.now() }
    return value
  } catch (error) {
    console.warn('Failed to read public album list version:', error)
    return memo?.value ?? '0'
  }
}

/**
 * Drop every cached public album list page. Call after a change the list
 * shows (create, edit, cover, authors, delete), once the D1 write is done.
 */
export async function invalidatePublicAlbumList(): Promise<void> {
  const value = Date.now().toString(36)
  publicListVersionMemo = { value, at: Date.now() }
  try {
    const { env } = await import('cloudflare:workers')
    await (env.meriksirat_kv as KVNamespace).put(PUBLIC_LIST_VERSION_KEY, value)
  } catch (error) {
    console.warn('Failed to invalidate public album list cache:', error)
  }
}

async function publicPageKey(query: unknown): Promise<string> {
  const raw = JSON.stringify(query)
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0
  }
  const version = await publicListVersion()
  return `album:publist:${version}:${(hash >>> 0).toString(36)}`
}

export async function getCachedPublicPage(
  query: unknown
): Promise<unknown | null> {
  return publicPageCache.get(await publicPageKey(query))
}

export async function setCachedPublicPage(
  query: unknown,
  page: unknown
): Promise<void> {
  return publicPageCache.set(await publicPageKey(query), page)
}
