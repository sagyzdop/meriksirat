import { auth } from '@/lib/auth/auth'
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
  const session = await auth.api.getSession({ headers })
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
// in KV for ~60s. Uploads invalidate the cache right away.
// ---------------------------------------------------------------------------

const LISTING_TTL_SECONDS = 60

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
