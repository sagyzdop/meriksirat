import { createServerFn } from '@tanstack/react-start'
import {
  ALBUM_CREATE_MIN_CLEARANCE,
  AlbumListQuerySchema,
  ClaimEditAccessSchema,
  CreateAlbumSchema,
  CreateUploadSessionSchema,
  DeleteAlbumSchema,
  DeletePhotoSchema,
  GetAlbumSchema,
  RecreateAlbumSchema,
  RefreshAlbumSchema,
  RemoveMemberSchema,
  RestoreAlbumSchema,
  RotateEditTokenSchema,
  SetCoverPhotoSchema,
  ToggleAlbumShareSchema,
  UpdateAlbumSchema,
} from './types'
import type {
  AlbumAuthor,
  AlbumDetail,
  AlbumFolderState,
  AlbumListPage,
  AlbumListQuery,
  AlbumPhoto,
  AlbumSummary,
  UploadSession,
} from './types'
import { albumPhotoUrls, albumCoverUrl } from './urls'

// ---------------------------------------------------------------------------
// Helpers (server-only)
// ---------------------------------------------------------------------------

async function loadAlbum(
  database: ReturnType<(typeof import('@/db'))['db']>,
  albumId: string
) {
  const { album } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')
  const row = await database
    .select()
    .from(album)
    .where(eq(album.id, albumId))
    .get()
  if (!row) throw new Error('Album not found')
  return row
}

async function loadAlbumOrNull(
  database: ReturnType<(typeof import('@/db'))['db']>,
  albumId: string
) {
  const { album } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')
  return database.select().from(album).where(eq(album.id, albumId)).get()
}

type AlbumRowWithAuthors =
  (typeof import('@/db/schema'))['album']['$inferSelect'] & {
    owner: {
      id: string
      name: string
      telegramUsername: string | null
    } | null
    members: {
      user: {
        id: string
        name: string
        telegramUsername: string | null
      } | null
    }[]
  }

/**
 * Keyset pagination over the `(createdAt desc, id desc)` ordering. The cursor
 * is an opaque, URL-safe token encoding the last row's position.
 */
function encodeAlbumCursor(createdAtMs: number, id: string): string {
  const raw = `${createdAtMs}:${id}`
  return typeof btoa === 'function'
    ? btoa(raw)
    : Buffer.from(raw, 'utf-8').toString('base64')
}

function decodeAlbumCursor(
  cursor: string | null | undefined
): { createdAtMs: number; id: string } | null {
  if (!cursor) return null
  try {
    const raw =
      typeof atob === 'function'
        ? atob(cursor)
        : Buffer.from(cursor, 'base64').toString('utf-8')
    const sep = raw.indexOf(':')
    const createdAtMs = Number(raw.slice(0, sep))
    const id = raw.slice(sep + 1)
    if (!Number.isFinite(createdAtMs) || !id) return null
    return { createdAtMs, id }
  } catch {
    return null
  }
}

function toAlbumSummary(
  row: AlbumRowWithAuthors,
  me: string | null,
  ownershipOverride?: 'owner' | 'co-author'
): AlbumSummary {
  const authors: AlbumAuthor[] = [
    ...(row.owner
      ? [
          {
            id: row.owner.id,
            name: row.owner.name,
            telegramUsername: row.owner.telegramUsername,
          },
        ]
      : []),
    ...(row.members ?? [])
      .map((m) =>
        m.user
          ? {
              id: m.user.id,
              name: m.user.name,
              telegramUsername: m.user.telegramUsername,
            }
          : null
      )
      .filter((a): a is AlbumAuthor => !!a),
  ]
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description ?? '',
    driveFolderId: row.driveFolderId,
    coverFileId: row.coverFileId,
    coverUrl: row.coverFileId ? albumCoverUrl(row.coverFileId) : null,
    isShared: !!row.isShared,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownership:
      ownershipOverride ??
      (me && row.ownerUserId === me ? 'owner' : 'co-author'),
    coAuthorCount: (row.members ?? []).length,
    authors,
  }
}

interface ListAlbumsPaginatedArgs {
  database: ReturnType<(typeof import('@/db'))['db']>
  /**
   * Scoping predicate (access, isShared, etc.).
   */
  baseWhere?: import('drizzle-orm').SQL
  /**
   * Ownership filter predicate for a given ownership value.
   */
  ownershipWhere?: (
    ownership: 'owner' | 'co-author'
  ) => import('drizzle-orm').SQL | undefined
  me?: string | null
  ownershipOverride?: 'owner' | 'co-author'
  query: AlbumListQuery
}

const withAuthors = {
  owner: {
    columns: { id: true, name: true, telegramUsername: true },
  },
  members: {
    with: {
      user: {
        columns: { id: true, name: true, telegramUsername: true },
      },
    },
  },
} as const

/**
 * Run a paginated album list query applying filters (search over title and
 * description, ownership, visibility) and keyset pagination.
 */
async function listAlbumsPaginated({
  database,
  baseWhere,
  ownershipWhere,
  me = null,
  ownershipOverride,
  query,
}: ListAlbumsPaginatedArgs): Promise<AlbumListPage> {
  const { album } = await import('@/db/schema')
  const { and, desc, eq, lt, like, or, sql } = await import('drizzle-orm')

  const conditions: import('drizzle-orm').SQL[] = []
  if (baseWhere) conditions.push(baseWhere)

  const search = (query.search ?? '').trim()
  if (search) {
    const pattern = `%${search.toLowerCase()}%`
    conditions.push(
      or(
        like(sql`lower(${album.title})`, pattern),
        like(sql`lower(${album.description})`, pattern)
      )!
    )
  }

  if (query.visibility === 'public') conditions.push(eq(album.isShared, true))
  if (query.visibility === 'private') conditions.push(eq(album.isShared, false))

  if (query.ownership !== 'all' && ownershipWhere) {
    const own = ownershipWhere(query.ownership)
    if (own) conditions.push(own)
  }

  const decoded = decodeAlbumCursor(query.cursor)
  if (decoded) {
    conditions.push(
      or(
        lt(album.createdAt, new Date(decoded.createdAtMs)),
        and(
          eq(album.createdAt, new Date(decoded.createdAtMs)),
          lt(album.id, decoded.id)
        )!
      )!
    )
  }

  const where = conditions.length ? and(...conditions) : undefined
  const limit = query.limit ?? 24

  const rows = await database.query.album.findMany({
    where,
    orderBy: [desc(album.createdAt), desc(album.id)],
    limit: limit + 1,
    with: withAuthors,
  })

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const last = pageRows[pageRows.length - 1]

  return {
    albums: pageRows.map((row) =>
      toAlbumSummary(row as AlbumRowWithAuthors, me, ownershipOverride)
    ),
    nextCursor:
      hasMore && last
        ? encodeAlbumCursor(last.createdAt.getTime(), last.id)
        : null,
  }
}

async function listAlbumsForCurrentUser(
  database: ReturnType<(typeof import('@/db'))['db']>,
  data: AlbumListQuery
): Promise<AlbumListPage> {
  const { getRequestHeaders } = await import('@tanstack/react-start/server')
  const { album, albumMember } = await import('@/db/schema')
  const { eq, and, ne, inArray, or } = await import('drizzle-orm')
  const { getSessionUser } = await import('./server')

  const headers = getRequestHeaders()
  const currentUser = await getSessionUser(headers)
  if (!currentUser) return { albums: [], nextCursor: null }
  const me = currentUser.id

  const memberRows = await database
    .select({ albumId: albumMember.albumId })
    .from(albumMember)
    .where(eq(albumMember.userId, me))
    .all()
  const memberAlbumIds = memberRows.map((r) => r.albumId)

  const baseWhere = memberAlbumIds.length
    ? or(eq(album.ownerUserId, me), inArray(album.id, memberAlbumIds))
    : eq(album.ownerUserId, me)

  const ownershipWhere = (ownership: 'owner' | 'co-author') =>
    ownership === 'owner'
      ? eq(album.ownerUserId, me)
      : memberAlbumIds.length
        ? and(ne(album.ownerUserId, me), inArray(album.id, memberAlbumIds))
        : undefined

  return listAlbumsPaginated({
    database,
    baseWhere,
    ownershipWhere,
    me,
    query: data,
  })
}

/**
 * Normalize a Drive capture timestamp to an ISO string.
 *
 * Drive's `imageMediaMetadata.time` is the EXIF capture time in the format
 * `YYYY:MM:DD HH:MM:SS` (camera-local, no timezone), which `new Date()` can't
 * parse. ISO timestamps (e.g. `createdTime`) parse directly.
 */
function normalizeCapturedAt(value: string | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
    value
  )
  if (!match) return ''
  const [, y, mo, d, h, mi, s] = match
  const exifParsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
  return Number.isNaN(exifParsed.getTime()) ? '' : exifParsed.toISOString()
}

async function listAlbumPhotos(driveFolderId: string): Promise<{
  photos: AlbumPhoto[]
  folderState: AlbumFolderState
}> {
  const { getCachedListing, setCachedListing } = await import('./server')
  const { getGoogleAccessToken } =
    await import('@/lib/google/google-calendar-auth')
  const { listDriveFolderFiles, getDriveFolderState, DriveNotFoundError } =
    await import('@/lib/google/google-drive')

  const cached = await getCachedListing(driveFolderId)

  let files: import('@/lib/google/google-drive').DriveFileMeta[]
  let folderState: AlbumFolderState

  if (cached) {
    files = cached.files
    folderState = cached.folderState
  } else {
    try {
      const accessToken = await getGoogleAccessToken()
      const [state, listed] = await Promise.all([
        getDriveFolderState(accessToken, driveFolderId),
        listDriveFolderFiles(accessToken, driveFolderId),
      ])
      folderState = state
      files = listed
      await setCachedListing(driveFolderId, files, folderState)
    } catch (error) {
      if (error instanceof DriveNotFoundError) {
        // The folder was permanently deleted directly in Google Drive.
        // Photos are gone.
        folderState = 'missing'
        files = []
        await setCachedListing(driveFolderId, files, folderState)
      } else {
        throw error
      }
    }
  }

  const photos = files
    .filter((f) => f.mimeType?.startsWith('image/'))
    .map((f) => {
      const capturedAt =
        normalizeCapturedAt(f.imageMediaMetadata?.time) || f.createdTime || ''
      const { url, thumbnailUrl } = albumPhotoUrls(f.id)
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        capturedAt,
        createdAt: f.createdTime ?? '',
        url,
        thumbnailUrl,
      }
    })
    .sort((a, b) => {
      if (a.capturedAt < b.capturedAt) return -1
      if (a.capturedAt > b.capturedAt) return 1
      return 0
    })

  return { photos, folderState }
}

/**
 * Pick a default cover: the first photo ever uploaded to the folder (earliest
 * Drive creation time). Returns null when there are no photos.
 */
function defaultCoverFileId(photos: AlbumPhoto[]): string | null {
  let earliest: AlbumPhoto | null = null
  for (const photo of photos) {
    const createdAt = photo.createdAt
    if (!createdAt) continue
    if (!earliest || createdAt < (earliest.createdAt ?? 0)) earliest = photo
  }
  return earliest?.id ?? null
}

async function buildAlbumDetail(
  database: ReturnType<(typeof import('@/db'))['db']>,
  albumId: string,
  headers: Headers
): Promise<AlbumDetail | null> {
  const { resolveAlbumAccess } = await import('./server')
  const { eq } = await import('drizzle-orm')
  const { album, albumMember, user } = await import('@/db/schema')

  const row = await loadAlbumOrNull(database, albumId)
  if (!row) return null

  const { user: currentUser, access } = await resolveAlbumAccess(headers, row)
  if (!row.isShared && access === 'none') return null

  const [listing, owner, members] = await Promise.all([
    listAlbumPhotos(row.driveFolderId),
    database
      .select({ name: user.name, telegramUsername: user.telegramUsername })
      .from(user)
      .where(eq(user.id, row.ownerUserId))
      .get(),
    database
      .select({
        userId: albumMember.userId,
        name: user.name,
        telegramUsername: user.telegramUsername,
      })
      .from(albumMember)
      .innerJoin(user, eq(albumMember.userId, user.id))
      .where(eq(albumMember.albumId, row.id))
      .all(),
  ])

  // No cover set yet: default to the first uploaded photo.
  const coverFileId = row.coverFileId ?? defaultCoverFileId(listing.photos)
  if (row.coverFileId !== coverFileId && coverFileId) {
    await database
      .update(album)
      .set({ coverFileId, updatedAt: new Date() })
      .where(eq(album.id, albumId))
  }

  const authors: AlbumAuthor[] = [
    {
      id: row.ownerUserId,
      name: owner?.name ?? 'Unknown',
      telegramUsername: owner?.telegramUsername ?? null,
    },
    ...members.map((m) => ({
      id: m.userId,
      name: m.name,
      telegramUsername: m.telegramUsername,
    })),
  ]

  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description ?? '',
    driveFolderId: row.driveFolderId,
    coverFileId,
    coverUrl: coverFileId ? albumCoverUrl(coverFileId) : null,
    isShared: !!row.isShared,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownership:
      currentUser && row.ownerUserId === currentUser.id ? 'owner' : 'co-author',
    coAuthorCount: members.length,
    authors,
    photos: listing.photos,
    folderState: listing.folderState,
    access,
    editShareToken: access !== 'none' ? row.editShareToken : null,
  }
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

/**
 * Resolve the Albums/{year}/{month} folder chain, creating any missing level.
 */
async function resolveMonthFolder(
  accessToken: string
): Promise<{ id: string }> {
  const { getOrCreateDriveFolder } = await import('@/lib/google/google-drive')
  const now = new Date()
  const year = String(now.getUTCFullYear())
  const month = now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })

  const albumsRoot = await getOrCreateDriveFolder(accessToken, 'Albums', 'root')
  const yearFolder = await getOrCreateDriveFolder(
    accessToken,
    year,
    albumsRoot.id
  )
  return getOrCreateDriveFolder(accessToken, month, yearFolder.id)
}

export const createAlbumFn = createServerFn({ method: 'POST' })
  .validator(CreateAlbumSchema)
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { createDriveFolder, setAnyoneReader } =
      await import('@/lib/google/google-drive')
    const { getSessionUser } = await import('./server')
    const { newAlbumId, newShareToken } = await import('./ids')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (!currentUser) throw new Error('Unauthorized')
    if (currentUser.clearanceLevel < ALBUM_CREATE_MIN_CLEARANCE) {
      throw new Error(
        `Album creation requires clearance level ${ALBUM_CREATE_MIN_CLEARANCE} or higher`
      )
    }

    const accessToken = await getGoogleAccessToken()
    const monthFolder = await resolveMonthFolder(accessToken)
    const folder = await createDriveFolder(
      accessToken,
      data.title,
      monthFolder.id
    )

    // Albums are always created public: the Drive folder is open to anyone
    // with the link, so photos can be served straight from Google's CDN.
    await setAnyoneReader(accessToken, folder.id)

    const database = db(env.meriksirat_d1 as D1Database)
    const albumId = newAlbumId()

    await database.insert(album).values({
      id: albumId,
      ownerUserId: currentUser.id,
      title: data.title,
      description: data.description ?? '',
      driveFolderId: folder.id,
      editShareToken: newShareToken(),
      isShared: true,
    })

    return { id: albumId }
  })

export const getMyAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AlbumListQuerySchema)
  .handler(async ({ data }): Promise<AlbumListPage> => {
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')

    const database = db(env.meriksirat_d1 as D1Database)
    return listAlbumsForCurrentUser(database, data)
  })

export const getPublicAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AlbumListQuerySchema)
  .handler(async ({ data }): Promise<AlbumListPage> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { rateLimit } = await import('@/lib/ratelimit')

    const headers = getRequestHeaders()

    // Public albums are listed without authentication — anyone with the link
    // can browse the shared gallery. Only `is_shared` albums appear here, so
    // the ownership filter does not apply. Rate-limited per IP to stop a
    // scripted client from hammering D1 reads.
    const limit = await rateLimit(headers, {
      name: 'public-albums',
      limit: 120,
    })
    if (!limit.allowed) {
      throw new Error(
        `Too many requests. Try again in ${limit.retryAfterSeconds} seconds.`
      )
    }

    const database = db(env.meriksirat_d1 as D1Database)

    return listAlbumsPaginated({
      database,
      baseWhere: eq(album.isShared, true),
      ownershipWhere: () => undefined,
      ownershipOverride: 'co-author',
      query: data,
    })
  })

export const getAllAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AlbumListQuerySchema)
  .handler(async ({ data }): Promise<AlbumListPage> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq, ne } = await import('drizzle-orm')
    const { getSessionUser } = await import('./server')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'manager')
    ) {
      return { albums: [], nextCursor: null }
    }
    const me = currentUser.id

    const database = db(env.meriksirat_d1 as D1Database)

    return listAlbumsPaginated({
      database,
      ownershipWhere: (ownership) =>
        ownership === 'owner'
          ? eq(album.ownerUserId, me)
          : ne(album.ownerUserId, me),
      me,
      query: data,
    })
  })

export const getAlbumFn = createServerFn({ method: 'GET' })
  .validator(GetAlbumSchema)
  .handler(async ({ data }): Promise<AlbumDetail | null> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    // Guests are rate-limited per IP before any Drive or D1 work so a scripted
    // client cannot probe albums or burn Drive quota. Authenticated users are
    // unlimited (members on a shared campus NAT must not be throttled).
    const { getSessionUser } = await import('./server')
    if (!(await getSessionUser(headers))) {
      const { rateLimit } = await import('@/lib/ratelimit')
      const limit = await rateLimit(headers, {
        name: 'album-detail',
        limit: 60,
      })
      if (!limit.allowed) {
        throw new Error(
          `Too many requests. Try again in ${limit.retryAfterSeconds} seconds.`
        )
      }
    }

    return buildAlbumDetail(database, data.albumId, headers)
  })

export const refreshAlbumFn = createServerFn({ method: 'POST' })
  .validator(RefreshAlbumSchema)
  .handler(async ({ data }): Promise<AlbumDetail | null> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { resolveAlbumAccess, invalidateCachedListing } =
      await import('./server')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    if (!['owner', 'editor', 'manager'].includes(access)) {
      throw new Error('Insufficient permissions')
    }

    await invalidateCachedListing(row.driveFolderId)
    return buildAlbumDetail(database, data.albumId, headers)
  })

export const recreateAlbumFolderFn = createServerFn({ method: 'POST' })
  .validator(RecreateAlbumSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess, invalidateCachedListing } =
      await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { createDriveFolder } = await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'manager'])

    const accessToken = await getGoogleAccessToken()
    const monthFolder = await resolveMonthFolder(accessToken)
    const folder = await createDriveFolder(
      accessToken,
      row.title,
      monthFolder.id
    )

    await invalidateCachedListing(row.driveFolderId)
    await database
      .update(album)
      .set({ driveFolderId: folder.id, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))

    return { success: true }
  })

export const restoreAlbumFolderFn = createServerFn({ method: 'POST' })
  .validator(RestoreAlbumSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { resolveAlbumAccess, requireAccess, invalidateCachedListing } =
      await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { restoreDriveFile } = await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    const accessToken = await getGoogleAccessToken()
    await restoreDriveFile(accessToken, row.driveFolderId)
    await invalidateCachedListing(row.driveFolderId)

    return { success: true }
  })

export const updateAlbumFn = createServerFn({ method: 'POST' })
  .validator(UpdateAlbumSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess } = await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { renameDriveFile, DriveNotFoundError } =
      await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    // Keep the Drive folder name in sync with the album title.
    if (data.title !== undefined && data.title.trim() !== row.title) {
      const accessToken = await getGoogleAccessToken()
      try {
        await renameDriveFile(accessToken, row.driveFolderId, data.title.trim())
      } catch (error) {
        if (error instanceof DriveNotFoundError) {
          throw new Error(
            'The album folder was deleted from Google Drive. Use "Recreate folder" to fix it.'
          )
        }
        throw new Error('Failed to rename the Drive folder')
      }
    }

    const updates: Record<string, unknown> = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date()
      await database
        .update(album)
        .set(updates)
        .where(eq(album.id, data.albumId))
    }

    return { success: true }
  })

export const deleteAlbumFn = createServerFn({ method: 'POST' })
  .validator(DeleteAlbumSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess, invalidateCachedListing } =
      await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { deleteDriveFile } = await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'manager'])

    const accessToken = await getGoogleAccessToken()
    try {
      await deleteDriveFile(accessToken, row.driveFolderId)
    } catch (error) {
      console.warn(
        'Failed to delete Drive folder, continuing with DB cleanup:',
        error
      )
    }
    await invalidateCachedListing(row.driveFolderId)
    await database.delete(album).where(eq(album.id, data.albumId))

    return { success: true }
  })

export const toggleAlbumShareFn = createServerFn({ method: 'POST' })
  .validator(ToggleAlbumShareSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess } = await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { setAnyoneReader } = await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    // `is_shared` only controls whether the album link works in the app.
    // The Drive folder always stays public (anyone reader), so photos keep
    // loading from Google's CDN regardless.
    if (data.shared) {
      const accessToken = await getGoogleAccessToken()
      await setAnyoneReader(accessToken, row.driveFolderId)
    }

    await database
      .update(album)
      .set({ isShared: data.shared, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))

    return { success: true, isShared: data.shared }
  })

export const claimEditAccessFn = createServerFn({ method: 'POST' })
  .validator(ClaimEditAccessSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { albumMember } = await import('@/db/schema')
    const { getSessionUser } = await import('./server')
    const { newId } = await import('./ids')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (!currentUser) throw new Error('Unauthorized')

    const database = db(env.meriksirat_d1 as D1Database)
    const row = await loadAlbum(database, data.albumId)

    if (row.editShareToken !== data.token) {
      throw new Error('Invalid share link')
    }

    if (row.ownerUserId !== currentUser.id) {
      await database
        .insert(albumMember)
        .values({ id: newId(12), albumId: row.id, userId: currentUser.id })
        .onConflictDoNothing()
    }

    return { success: true, access: 'editor' }
  })

export const rotateEditTokenFn = createServerFn({ method: 'POST' })
  .validator(RotateEditTokenSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess } = await import('./server')
    const { newShareToken } = await import('./ids')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'manager'])

    // A fresh token invalidates every previously shared edit link.
    const editShareToken = newShareToken()
    await database
      .update(album)
      .set({ editShareToken, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))

    return { success: true, editShareToken }
  })

export const createUploadSessionFn = createServerFn({ method: 'POST' })
  .validator(CreateUploadSessionSchema)
  .handler(async ({ data }): Promise<UploadSession> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { resolveAlbumAccess, requireAccess, invalidateCachedListing } =
      await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { mintResumableUpload, findDriveFileByName, getDriveFolderState } =
      await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    const accessToken = await getGoogleAccessToken()

    // Uploads are blocked while the folder is in the bin or permanently
    // deleted, so photos never silently land in an unreachable folder.
    const folderState = await getDriveFolderState(
      accessToken,
      row.driveFolderId
    )
    if (folderState === 'trashed') {
      throw new Error(
        'The album folder is in the Google Drive bin. Restore it before uploading.'
      )
    }
    if (folderState === 'missing') {
      throw new Error(
        'The album folder was deleted from Google Drive. Use "Recreate folder" to fix it.'
      )
    }

    // Reject exact-name duplicates inside the album folder.
    const existing = await findDriveFileByName(
      accessToken,
      data.fileName,
      row.driveFolderId
    )
    if (existing) {
      throw new Error(`Photo "${data.fileName}" already exists in this album`)
    }

    const uploadUrl = await mintResumableUpload(accessToken, {
      name: data.fileName,
      folderId: row.driveFolderId,
      mimeType: data.mimeType,
      origin: headers.get('origin') ?? undefined,
    })

    // A new file is about to appear in the folder.
    await invalidateCachedListing(row.driveFolderId)

    return { uploadUrl }
  })

export const deletePhotoFn = createServerFn({ method: 'POST' })
  .validator(DeletePhotoSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess, invalidateCachedListing } =
      await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { deleteDriveFile } = await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    const accessToken = await getGoogleAccessToken()
    await deleteDriveFile(accessToken, data.fileId)
    await invalidateCachedListing(row.driveFolderId)

    if (row.coverFileId === data.fileId) {
      await database
        .update(album)
        .set({ coverFileId: null, updatedAt: new Date() })
        .where(eq(album.id, data.albumId))
    }

    return { success: true }
  })

export const setCoverPhotoFn = createServerFn({ method: 'POST' })
  .validator(SetCoverPhotoSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { resolveAlbumAccess, requireAccess } = await import('./server')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    await database
      .update(album)
      .set({ coverFileId: data.fileId, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))

    return { success: true }
  })

export const removeMemberFn = createServerFn({ method: 'POST' })
  .validator(RemoveMemberSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { albumMember } = await import('@/db/schema')
    const { and, eq } = await import('drizzle-orm')
    const { resolveAlbumAccess } = await import('./server')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { user: currentUser, access } = await resolveAlbumAccess(headers, row)

    // Owner/manager may remove anyone; a co-author may only remove themselves.
    const isSelfRemoval =
      access === 'editor' && !!currentUser && data.userId === currentUser.id
    if (access !== 'owner' && access !== 'manager' && !isSelfRemoval) {
      throw new Error('Insufficient permissions')
    }

    await database
      .delete(albumMember)
      .where(
        and(
          eq(albumMember.albumId, data.albumId),
          eq(albumMember.userId, data.userId)
        )
      )

    return { success: true }
  })
