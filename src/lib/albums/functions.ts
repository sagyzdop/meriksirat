import { createServerFn } from '@tanstack/react-start'
import {
  AlbumFilterSchema,
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
  SetCoverPhotoSchema,
  ToggleAlbumShareSchema,
  UpdateAlbumSchema,
} from './types'
import type {
  AlbumAuthor,
  AlbumDetail,
  AlbumFolderState,
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

async function listAlbumPhotos(albumRow: {
  id: string
  driveFolderId: string
  isShared: boolean | null
}): Promise<{ photos: AlbumPhoto[]; folderState: AlbumFolderState }> {
  const { getCachedListing, setCachedListing } = await import('./server')
  const { getGoogleAccessToken } =
    await import('@/lib/google/google-calendar-auth')
  const { listDriveFolderFiles, getDriveFolderState, DriveNotFoundError } =
    await import('@/lib/google/google-drive')

  const cached = await getCachedListing(albumRow.driveFolderId)

  let files: import('@/lib/google/google-drive').DriveFileMeta[]
  let folderState: AlbumFolderState

  if (cached) {
    files = cached.files
    folderState = cached.folderState
  } else {
    try {
      const accessToken = await getGoogleAccessToken()
      const [state, listed] = await Promise.all([
        getDriveFolderState(accessToken, albumRow.driveFolderId),
        listDriveFolderFiles(accessToken, albumRow.driveFolderId),
      ])
      folderState = state
      files = listed
      await setCachedListing(albumRow.driveFolderId, files, folderState)
    } catch (error) {
      if (error instanceof DriveNotFoundError) {
        // The folder was permanently deleted directly in Google Drive.
        // Photos are gone.
        folderState = 'missing'
        files = []
        await setCachedListing(albumRow.driveFolderId, files, folderState)
      } else {
        throw error
      }
    }
  }

  const isShared = !!albumRow.isShared

  const photos = files
    .filter((f) => f.mimeType?.startsWith('image/'))
    .map((f) => {
      const capturedAt = f.imageMediaMetadata?.time ?? f.createdTime ?? ''
      const { url, thumbnailUrl } = albumPhotoUrls(albumRow.id, f.id, isShared)
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        capturedAt,
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

async function buildAlbumDetail(
  database: ReturnType<(typeof import('@/db'))['db']>,
  albumId: string,
  headers: Headers
): Promise<AlbumDetail | null> {
  const { resolveAlbumAccess } = await import('./server')
  const { eq } = await import('drizzle-orm')
  const { albumMember, user } = await import('@/db/schema')

  const row = await loadAlbumOrNull(database, albumId)
  if (!row) return null

  const { user: currentUser, access } = await resolveAlbumAccess(headers, row)
  if (!row.isShared && access === 'none') return null

  const [listing, owner, members] = await Promise.all([
    listAlbumPhotos(row),
    database
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, row.ownerUserId))
      .get(),
    database
      .select({ userId: albumMember.userId, name: user.name })
      .from(albumMember)
      .innerJoin(user, eq(albumMember.userId, user.id))
      .where(eq(albumMember.albumId, row.id))
      .all(),
  ])

  const authors: AlbumAuthor[] = [
    { id: row.ownerUserId, name: owner?.name ?? 'Unknown' },
    ...members.map((m) => ({ id: m.userId, name: m.name })),
  ]

  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description ?? '',
    driveFolderId: row.driveFolderId,
    coverFileId: row.coverFileId,
    coverUrl: row.coverFileId
      ? albumCoverUrl(row.id, row.coverFileId, !!row.isShared)
      : null,
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
  const yearFolder = await getOrCreateDriveFolder(accessToken, year, albumsRoot.id)
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
    const { createDriveFolder } = await import('@/lib/google/google-drive')
    const { getSessionUser } = await import('./server')
    const { newAlbumId, newShareToken } = await import('./ids')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (!currentUser) throw new Error('Unauthorized')

    const accessToken = await getGoogleAccessToken()
    const monthFolder = await resolveMonthFolder(accessToken)
    const folder = await createDriveFolder(accessToken, data.title, monthFolder.id)

    const database = db(env.meriksirat_d1 as D1Database)
    const albumId = newAlbumId()

    await database.insert(album).values({
      id: albumId,
      ownerUserId: currentUser.id,
      title: data.title,
      description: data.description ?? '',
      driveFolderId: folder.id,
      editShareToken: newShareToken(),
    })

    return { id: albumId }
  })

export const getMyAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AlbumFilterSchema)
  .handler(async ({ data: filter }): Promise<AlbumSummary[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album, albumMember } = await import('@/db/schema')
    const { eq, and, ne, inArray, desc, or, exists } =
      await import('drizzle-orm')
    const { getSessionUser } = await import('./server')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (!currentUser) return []
    const me = currentUser.id

    const database = db(env.meriksirat_d1 as D1Database)

    const memberRows = await database
      .select({ albumId: albumMember.albumId })
      .from(albumMember)
      .where(eq(albumMember.userId, me))
      .all()
    const memberAlbumIds = memberRows.map((r) => r.albumId)

    const withAuthors = {
      owner: { columns: { id: true, name: true } },
      members: {
        with: { user: { columns: { id: true, name: true } } },
      },
    } as const

    let whereExpr: import('drizzle-orm').SQL | undefined

    if (filter === 'owned') {
      whereExpr = eq(album.ownerUserId, me)
    } else if (filter === 'shared-with-me') {
      if (memberAlbumIds.length === 0) return []
      whereExpr = and(
        ne(album.ownerUserId, me),
        inArray(album.id, memberAlbumIds)
      )
    } else if (filter === 'shared-by-me') {
      whereExpr = and(
        eq(album.ownerUserId, me),
        exists(
          database
            .select({ id: albumMember.id })
            .from(albumMember)
            .where(eq(albumMember.albumId, album.id))
        )
      )
    } else {
      whereExpr = memberAlbumIds.length
        ? or(eq(album.ownerUserId, me), inArray(album.id, memberAlbumIds))
        : eq(album.ownerUserId, me)
    }

    const rows = await database.query.album.findMany({
      where: whereExpr,
      orderBy: desc(album.createdAt),
      with: withAuthors,
    })

    return rows.map((row): AlbumSummary => {
      const authors: AlbumAuthor[] = [
        ...(row.owner ? [{ id: row.owner.id, name: row.owner.name }] : []),
        ...(row.members ?? [])
          .map((m) => (m.user ? { id: m.user.id, name: m.user.name } : null))
          .filter((a): a is AlbumAuthor => !!a),
      ]
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        title: row.title,
        description: row.description ?? '',
        driveFolderId: row.driveFolderId,
        coverFileId: row.coverFileId,
        coverUrl: row.coverFileId
          ? albumCoverUrl(row.id, row.coverFileId, !!row.isShared)
          : null,
        isShared: !!row.isShared,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ownership: row.ownerUserId === me ? 'owner' : 'co-author',
        coAuthorCount: (row.members ?? []).length,
        authors,
      }
    })
  })

export const getAllAlbumsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AlbumSummary[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { desc } = await import('drizzle-orm')
    const { getSessionUser } = await import('./server')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'manager')
    ) {
      return []
    }
    const me = currentUser.id

    const database = db(env.meriksirat_d1 as D1Database)

    const rows = await database.query.album.findMany({
      orderBy: desc(album.createdAt),
      with: {
        owner: { columns: { id: true, name: true } },
        members: {
          with: { user: { columns: { id: true, name: true } } },
        },
      },
    })

    return rows.map((row): AlbumSummary => {
      const authors: AlbumAuthor[] = [
        ...(row.owner ? [{ id: row.owner.id, name: row.owner.name }] : []),
        ...(row.members ?? [])
          .map((m) => (m.user ? { id: m.user.id, name: m.user.name } : null))
          .filter((a): a is AlbumAuthor => !!a),
      ]
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        title: row.title,
        description: row.description ?? '',
        driveFolderId: row.driveFolderId,
        coverFileId: row.coverFileId,
        coverUrl: row.coverFileId
          ? albumCoverUrl(row.id, row.coverFileId, !!row.isShared)
          : null,
        isShared: !!row.isShared,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ownership: row.ownerUserId === me ? 'owner' : 'co-author',
        coAuthorCount: (row.members ?? []).length,
        authors,
      }
    })
  }
)

export const getAlbumFn = createServerFn({ method: 'GET' })
  .validator(GetAlbumSchema)
  .handler(async ({ data }): Promise<AlbumDetail | null> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

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
    const folder = await createDriveFolder(accessToken, row.title, monthFolder.id)

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
    const { setAnyoneReader, removeAnyoneReader } =
      await import('@/lib/google/google-drive')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    const row = await loadAlbum(database, data.albumId)
    const { access } = await resolveAlbumAccess(headers, row)
    requireAccess(access, ['owner', 'editor', 'manager'])

    const accessToken = await getGoogleAccessToken()
    if (data.shared) {
      await setAnyoneReader(accessToken, row.driveFolderId)
    } else {
      await removeAnyoneReader(accessToken, row.driveFolderId)
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
    const {
      mintResumableUpload,
      findDriveFileByName,
      getDriveFolderState,
    } = await import('@/lib/google/google-drive')

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
