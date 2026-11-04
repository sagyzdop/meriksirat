import { createServerFn } from '@tanstack/react-start'
import {
  ALBUM_CREATE_MIN_CLEARANCE,
  AlbumIdSchema,
  AlbumListQuerySchema,
  ClaimEditAccessSchema,
  ConfirmPhotoUploadSchema,
  CreateAlbumSchema,
  CreateUploadSessionSchema,
  DeletePhotoSchema,
  RemoveMemberSchema,
  SetAlbumPinnedSchema,
  SetCoverPhotoSchema,
  UpdateAlbumSchema,
} from './types'
import type {
  AlbumAccessLevel,
  AlbumDetail,
  AlbumListPage,
  UploadSession,
} from './types'
import { NEEDS_HASH_MESSAGE, planDuplicateCheck } from './upload-dedupe'
import { defaultExpiry } from '@/lib/pool/expiry'
import { BUFFER_OWNER_ID } from '@/lib/buffer/plan'

type Database = ReturnType<(typeof import('@/db'))['db']>

async function loadAlbumOrNull(database: Database, albumId: string) {
  const { album } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')
  return database.select().from(album).where(eq(album.id, albumId)).get()
}

async function loadAlbum(database: Database, albumId: string) {
  const row = await loadAlbumOrNull(database, albumId)
  if (!row || row.deletedAt) throw new Error('Album not found')
  return row
}

async function albumContext(albumId: string, allowed: AlbumAccessLevel[]) {
  const { getRequestHeaders } = await import('@tanstack/react-start/server')
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')
  const { resolveAlbumAccess, requireAccess } = await import('./server')
  const headers = getRequestHeaders()
  const database = db(env.meriksirat_d1 as D1Database)
  const row = await loadAlbum(database, albumId)
  const { user, access } = await resolveAlbumAccess(headers, row)
  requireAccess(access, allowed)
  return { database, headers, row, user, access }
}

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
    const { album, user } = await import('@/db/schema')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { createDriveFolder, setAnyoneReader } =
      await import('@/lib/google/google-drive')
    const { getSessionUser } = await import('./server')
    const { newAlbumId, newShareToken } = await import('./ids')
    const { sql, eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const currentUser = await getSessionUser(headers)
    if (!currentUser) throw new Error('Unauthorized')
    if (currentUser.clearanceLevel < ALBUM_CREATE_MIN_CLEARANCE) {
      throw new Error(
        `Album creation requires clearance level ${ALBUM_CREATE_MIN_CLEARANCE} or higher`
      )
    }

    const { assertAccess } = await import('@/lib/access/server')
    await assertAccess(
      db(env.meriksirat_d1 as D1Database),
      currentUser.id,
      'canCreateAlbum',
      'Only club members can create albums'
    )

    const accessToken = await getGoogleAccessToken()
    const monthFolder = await resolveMonthFolder(accessToken)
    const folder = await createDriveFolder(
      accessToken,
      data.title,
      monthFolder.id
    )

    // Public folder: photos are served straight from Google's CDN.
    await setAnyoneReader(accessToken, folder.id)

    const database = db(env.meriksirat_d1 as D1Database)
    const albumId = newAlbumId()

    await database.insert(album).values({
      id: albumId,
      ownerUserId: currentUser.id,
      title: data.title,
      description: data.description ?? '',
      event: data.event,
      eventDate: new Date(data.eventDate),
      expiresAt: defaultExpiry(new Date(data.eventDate)),
      driveFolderId: folder.id,
      editShareToken: newShareToken(),
      photosIndexedAt: new Date(),
    })

    await database
      .update(user)
      .set({ albumCount: sql`${user.albumCount} + 1` })
      .where(eq(user.id, currentUser.id))

    const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
    await logAlbumActivityByUser(currentUser.id, {
      albumId,
      albumTitle: data.title,
      action: 'created',
    })

    return { id: albumId }
  })

export const getMyAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AlbumListQuerySchema)
  .handler(async ({ data }): Promise<AlbumListPage> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album, albumMember } = await import('@/db/schema')
    const { and, eq, inArray, ne, or } = await import('drizzle-orm')
    const { getSessionUser } = await import('./server')
    const { listAlbumsPaginated } = await import('./list')

    const currentUser = await getSessionUser(getRequestHeaders())
    if (!currentUser) return { albums: [], nextCursor: null }
    const me = currentUser.id
    const database = db(env.meriksirat_d1 as D1Database)

    // D1 caps bound parameters at 100/query, so membership is expressed as a
    // subquery rather than an in-memory id list.
    const memberAlbums = database
      .select({ albumId: albumMember.albumId })
      .from(albumMember)
      .where(eq(albumMember.userId, me))

    return listAlbumsPaginated({
      database,
      baseWhere: or(eq(album.ownerUserId, me), inArray(album.id, memberAlbums)),
      ownershipWhere: (ownership) =>
        ownership === 'owner'
          ? eq(album.ownerUserId, me)
          : and(ne(album.ownerUserId, me), inArray(album.id, memberAlbums)),
      me,
      query: data,
    })
  })

export const getPublicAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AlbumListQuerySchema)
  .handler(async ({ data }): Promise<AlbumListPage> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { rateLimit } = await import('@/lib/ratelimit')

    const headers = getRequestHeaders()

    // Public albums are listed without authentication — anyone with the link
    // can browse the gallery. Every album is listed, so the ownership filter
    // does not apply. Rate-limited per IP to stop a
    // scripted client from hammering D1 reads.
    const limit = await rateLimit(headers, 'rl_public_albums')
    if (!limit.allowed) {
      throw new Error(
        `Too many requests. Try again in ${limit.retryAfterSeconds} seconds.`
      )
    }

    const database = db(env.meriksirat_d1 as D1Database)

    // The page is fully viewer-independent, so serve it from the short-lived
    // page cache when possible (memo layer + KV; see server.ts).
    const { getCachedPublicPage, setCachedPublicPage } =
      await import('./server')
    const { listAlbumsPaginated } = await import('./list')
    const cachedPage = (await getCachedPublicPage(data)) as AlbumListPage | null
    if (cachedPage) return cachedPage

    const page = await listAlbumsPaginated({
      database,
      ownershipWhere: () => undefined,
      ownershipOverride: 'co-author',
      query: data,
    })
    await setCachedPublicPage(data, page)
    return page
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
    const { listAlbumsPaginated } = await import('./list')

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
  .validator(AlbumIdSchema)
  .handler(async ({ data }): Promise<AlbumDetail | null> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')

    const headers = getRequestHeaders()
    const database = db(env.meriksirat_d1 as D1Database)

    // Guests are rate-limited per IP before any Drive or D1 work so a scripted
    // client cannot probe albums or burn Drive quota. Authenticated users are
    // unlimited (members on a shared campus NAT must not be throttled).
    const {
      getSessionUser,
      getCachedDetailCore,
      setCachedDetailCore,
      resolveAlbumAccess,
    } = await import('./server')
    const { buildAlbumCore, buildTombstoneDetail, loadAlbumDetail } =
      await import('./detail')
    if (!(await getSessionUser(headers))) {
      const { rateLimit } = await import('@/lib/ratelimit')
      const limit = await rateLimit(headers, 'rl_album_detail')
      if (!limit.allowed) {
        throw new Error(
          `Too many requests. Try again in ${limit.retryAfterSeconds} seconds.`
        )
      }
    }

    // The authz gate always reads a fresh album row; only the viewer-independent
    // core and the Drive listings come from cache.
    const row = await loadAlbumOrNull(database, data.albumId)
    if (!row) return null

    const { user: currentUser, access } = await resolveAlbumAccess(headers, row)
    if (row.deletedAt) return buildTombstoneDetail(row)

    let core = (await getCachedDetailCore(data.albumId)) as Record<
      string,
      unknown
    > | null
    if (!core) {
      core = await buildAlbumCore(database, row)
      await setCachedDetailCore(data.albumId, core)
    }

    return loadAlbumDetail(database, core, row, access, currentUser)
  })

export const refreshAlbumFn = createServerFn({ method: 'POST' })
  .validator(AlbumIdSchema)
  .handler(async ({ data }): Promise<AlbumDetail | null> => {
    const { invalidateCachedDetailCore, setCachedDetailCore } =
      await import('./server')
    const { buildAlbumCore, loadAlbumDetail } = await import('./detail')

    const {
      database,
      headers,
      row,
      user: currentUser,
      access,
    } = await albumContext(data.albumId, ['owner', 'editor', 'manager'])

    // Refreshing re-lists every volume from the Drive API, so cap how often a
    // user can trigger it.
    if (currentUser?.id) {
      const { rateLimit } = await import('@/lib/ratelimit')
      const rl = await rateLimit(headers, 'rl_refresh_album', currentUser.id)
      if (!rl.allowed) {
        throw new Error('Too many refresh requests. Please try again shortly.')
      }
    }

    await invalidateCachedDetailCore(data.albumId)

    // Rebuild synchronously so the refresher sees fresh data immediately and
    // the next viewers are served the refreshed core from cache. The listing is
    // overwritten rather than cleared, so a failed listing keeps its last good
    // photos.
    const core = await buildAlbumCore(database, row)
    await setCachedDetailCore(data.albumId, core)
    return loadAlbumDetail(database, core, row, access, currentUser, {
      force: true,
    })
  })

export const deleteGoneAlbumFn = createServerFn({ method: 'POST' })
  .validator(AlbumIdSchema)
  .handler(async ({ data }) => {
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { getDriveFolderState } = await import('@/lib/google/google-drive')
    const { folderCheckVerdict, canDeleteGoneAlbum } =
      await import('./folder-warning')
    const { tombstoneGoneAlbum } = await import('./expiry')

    const {
      database,
      row,
      user: currentUser,
    } = await albumContext(data.albumId, ['manager'])

    const isAdmin = currentUser?.role === 'admin'
    if (!currentUser || !isAdmin) {
      throw new Error('Only an admin can delete this album.')
    }

    const accessToken = await getGoogleAccessToken()
    let verdict: ReturnType<typeof folderCheckVerdict>
    try {
      verdict = folderCheckVerdict({
        state: await getDriveFolderState(accessToken, row.driveFolderId),
      })
    } catch (error) {
      verdict = folderCheckVerdict({ error })
    }
    const decision = canDeleteGoneAlbum(verdict, { isAdmin })
    if (!decision.ok) throw new Error(decision.message)

    await tombstoneGoneAlbum(database, row)

    const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
    await logAlbumActivityByUser(currentUser.id, {
      albumId: data.albumId,
      albumTitle: row.title,
      action: 'deleted',
    })

    return { success: true }
  })

export const updateAlbumFn = createServerFn({ method: 'POST' })
  .validator(UpdateAlbumSchema)
  .handler(async ({ data }) => {
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { invalidateCachedDetailCore } = await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { renameDriveFile, DriveNotFoundError } =
      await import('@/lib/google/google-drive')

    const {
      database,
      row,
      user: currentUser,
    } = await albumContext(data.albumId, ['owner', 'editor', 'manager'])

    // Keep the Drive folder name in sync with the album title.
    if (data.title !== undefined && data.title.trim() !== row.title) {
      const accessToken = await getGoogleAccessToken()
      try {
        await renameDriveFile(accessToken, row.driveFolderId, data.title.trim())
      } catch (error) {
        if (error instanceof DriveNotFoundError) {
          throw new Error(
            'The album folder was deleted from Google Drive, so it cannot be renamed.'
          )
        }
        throw new Error('Failed to rename the Drive folder')
      }
    }

    const updates: Record<string, unknown> = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.event !== undefined) updates.event = data.event
    if (data.eventDate !== undefined) {
      updates.eventDate = data.eventDate ? new Date(data.eventDate) : null
      if (data.eventDate && !row.pinned) {
        updates.expiresAt = defaultExpiry(new Date(data.eventDate))
        updates.expiryReminder30SentAt = null
        updates.expiryReminder7SentAt = null
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date()
      await database
        .update(album)
        .set(updates)
        .where(eq(album.id, data.albumId))
      await invalidateCachedDetailCore(data.albumId)
    }

    const detailParts: string[] = []
    if (data.title !== undefined && data.title.trim() !== row.title) {
      detailParts.push(`Title: ${row.title} → ${data.title.trim()}`)
    }
    if (data.description !== undefined) {
      detailParts.push('Description updated')
    }
    if (data.event !== undefined) {
      detailParts.push(`Event: ${row.event} → ${data.event}`)
    }
    if (data.eventDate !== undefined) {
      detailParts.push('Event date updated')
    }

    if (currentUser && detailParts.length > 0) {
      const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
      await logAlbumActivityByUser(currentUser.id, {
        albumId: data.albumId,
        albumTitle: row.title,
        action: 'updated',
        details: detailParts,
      })
    }

    return { success: true }
  })

export const setAlbumPinnedFn = createServerFn({ method: 'POST' })
  .validator(SetAlbumPinnedSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { getSessionUser } = await import('./server')

    const currentUser = await getSessionUser(getRequestHeaders())
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can pin albums')
    }

    const database = db(env.meriksirat_d1 as D1Database)
    await loadAlbum(database, data.albumId)
    await database
      .update(album)
      .set({ pinned: data.pinned, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))

    return { success: true }
  })

export const deleteAlbumFn = createServerFn({ method: 'POST' })
  .validator(AlbumIdSchema)
  .handler(async ({ data }) => {
    const { removeAlbum } = await import('./expiry')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')

    const {
      database,
      row,
      user: currentUser,
    } = await albumContext(data.albumId, ['owner', 'manager'])

    const accessToken = await getGoogleAccessToken()
    await removeAlbum(database, row, accessToken)

    if (currentUser) {
      const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
      await logAlbumActivityByUser(currentUser.id, {
        albumId: data.albumId,
        albumTitle: row.title,
        action: 'deleted',
      })
    }

    return { success: true }
  })

export const claimEditAccessFn = createServerFn({ method: 'POST' })
  .validator(ClaimEditAccessSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { albumMember, user } = await import('@/db/schema')
    const { eq, sql } = await import('drizzle-orm')
    const { getSessionUser, invalidateCachedDetailCore } =
      await import('./server')
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

      await database
        .update(user)
        .set({ albumCount: sql`${user.albumCount} + 1` })
        .where(eq(user.id, currentUser.id))

      await invalidateCachedDetailCore(row.id)

      const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
      await logAlbumActivityByUser(currentUser.id, {
        albumId: row.id,
        albumTitle: row.title,
        action: 'member_added',
      })
    }

    return { success: true, access: 'editor' }
  })

export const rotateEditTokenFn = createServerFn({ method: 'POST' })
  .validator(AlbumIdSchema)
  .handler(async ({ data }) => {
    const { album } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { newShareToken } = await import('./ids')

    const {
      database,
      row,
      user: currentUser,
    } = await albumContext(data.albumId, ['owner', 'manager'])

    // A fresh token invalidates every previously shared edit link.
    const editShareToken = newShareToken()
    await database
      .update(album)
      .set({ editShareToken, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))

    if (currentUser) {
      const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
      await logAlbumActivityByUser(currentUser.id, {
        albumId: data.albumId,
        albumTitle: row.title,
        action: 'token_rotated',
      })
    }

    return { success: true, editShareToken }
  })

export const createUploadSessionFn = createServerFn({ method: 'POST' })
  .validator(CreateUploadSessionSchema)
  .handler(async ({ data }): Promise<UploadSession> => {
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { getDriveFolderState } = await import('@/lib/google/google-drive')
    const { startBufferUpload } = await import('@/lib/buffer/server')

    const { database, row, headers } = await albumContext(data.albumId, [
      'owner',
      'editor',
      'manager',
    ])

    const accessToken = await getGoogleAccessToken()

    // Uploads are blocked while the folder is in the bin or permanently
    // deleted, so photos never silently land in an unreachable folder.
    const folderState = await getDriveFolderState(
      accessToken,
      row.driveFolderId
    )
    if (folderState === 'trashed') {
      throw new Error(
        'The album folder is in the Google Drive bin, so uploads are paused.'
      )
    }
    if (folderState === 'missing') {
      throw new Error(
        'The album folder was deleted from Google Drive, so uploads are paused.'
      )
    }

    const { loadAlbumListing } = await import('./listing-server')
    const listing = await loadAlbumListing(database, row)
    const check = planDuplicateCheck(data.size, data.md5, listing.files)
    if (check.kind === 'needs-hash') throw new Error(NEEDS_HASH_MESSAGE)
    if (check.kind === 'duplicate') {
      throw new Error(`Photo "${data.fileName}" already exists in this album`)
    }

    return startBufferUpload(database, row, {
      name: data.fileName,
      mimeType: data.mimeType,
      bytes: data.size,
      origin: headers.get('origin') ?? undefined,
    })
  })

export const confirmPhotoUploadFn = createServerFn({ method: 'POST' })
  .validator(ConfirmPhotoUploadSchema)
  .handler(async ({ data }) => {
    const { database, row } = await albumContext(data.albumId, [
      'owner',
      'editor',
      'manager',
    ])

    const { confirmBufferUpload } = await import('@/lib/buffer/server')
    const registered = await confirmBufferUpload(database, row, data.fileId)
    return { registered }
  })

export const deletePhotoFn = createServerFn({ method: 'POST' })
  .validator(DeletePhotoSchema)
  .handler(async ({ data }) => {
    const { album, photo } = await import('@/db/schema')
    const { and, eq, sql } = await import('drizzle-orm')
    const { invalidateCachedListing, invalidateCachedDetailCore } =
      await import('./server')
    const { getGoogleAccessToken } =
      await import('@/lib/google/google-calendar-auth')
    const { deleteDriveFile } = await import('@/lib/google/google-drive')

    const {
      database,
      row,
      user: currentUser,
    } = await albumContext(data.albumId, ['owner', 'editor', 'manager'])

    const registered = await database
      .select({
        id: photo.id,
        driveFileId: photo.driveFileId,
        bytes: photo.bytes,
        flamekeeperUserId: photo.flamekeeperUserId,
      })
      .from(photo)
      .where(and(eq(photo.driveFileId, data.fileId), eq(photo.albumId, row.id)))
      .get()
    // A listed upload whose confirm never landed has no row, so the listing
    // says whose token can delete it.
    const { findAlbumFileOwner, withListingOwnerToken } =
      await import('./listing-server')
    const listedOwner = registered
      ? null
      : await findAlbumFileOwner(database, row, data.fileId)
    if (!registered && !listedOwner && row.photosIndexedAt) {
      throw new Error('Photo not found in this album')
    }

    if (registered?.flamekeeperUserId) {
      const { deleteOwnedPhotos } = await import('@/lib/pool/server')
      const { error } = await deleteOwnedPhotos(database, [registered])
      if (error) throw error
    } else if (listedOwner) {
      await withListingOwnerToken(database, listedOwner, (token) =>
        deleteDriveFile(token, data.fileId)
      )
    } else {
      await deleteDriveFile(await getGoogleAccessToken(), data.fileId)
    }
    if (registered?.flamekeeperUserId === BUFFER_OWNER_ID) {
      const { adjustExpected } = await import('@/lib/buffer/server')
      await adjustExpected(database, row.id, -1, -registered.bytes)
    }
    const { favorite } = await import('@/db/schema')
    await database.batch([
      database
        .update(album)
        .set({
          ...(registered && {
            photoCount: sql`MAX(${album.photoCount} - 1, 0)`,
            photoBytes: sql`MAX(${album.photoBytes} - ${registered.bytes}, 0)`,
          }),
          favoriteCount: sql`MAX(${album.favoriteCount} - (SELECT COUNT(*) FROM ${favorite} WHERE ${favorite.albumId} = ${row.id} AND ${favorite.driveFileId} = ${data.fileId}), 0)`,
        })
        .where(eq(album.id, row.id)),
      database
        .delete(favorite)
        .where(
          and(
            eq(favorite.albumId, row.id),
            eq(favorite.driveFileId, data.fileId)
          )
        ),
      ...(registered
        ? [database.delete(photo).where(eq(photo.id, registered.id))]
        : []),
    ])
    await invalidateCachedListing(row.driveFolderId)

    if (row.coverFileId === data.fileId) {
      await database
        .update(album)
        .set({ coverFileId: null, updatedAt: new Date() })
        .where(eq(album.id, data.albumId))
    }
    await invalidateCachedDetailCore(data.albumId)

    if (currentUser) {
      const { logAlbumActivityByUser } = await import('@/lib/telegram/logging')
      await logAlbumActivityByUser(currentUser.id, {
        albumId: data.albumId,
        albumTitle: row.title,
        action: 'photo_deleted',
      })
    }

    return { success: true }
  })

export const setCoverPhotoFn = createServerFn({ method: 'POST' })
  .validator(SetCoverPhotoSchema)
  .handler(async ({ data }) => {
    const { album, photo } = await import('@/db/schema')
    const { and, eq } = await import('drizzle-orm')
    const { invalidateCachedDetailCore } = await import('./server')

    const { database, row } = await albumContext(data.albumId, [
      'owner',
      'editor',
      'manager',
    ])

    if (row.photosIndexedAt) {
      const registered = await database
        .select({ id: photo.id })
        .from(photo)
        .where(
          and(eq(photo.driveFileId, data.fileId), eq(photo.albumId, row.id))
        )
        .get()
      if (!registered) {
        const { findAlbumFileOwner } = await import('./listing-server')
        const owner = await findAlbumFileOwner(database, row, data.fileId)
        if (!owner) throw new Error('Photo not found in this album')
      }
    }

    await database
      .update(album)
      .set({ coverFileId: data.fileId, updatedAt: new Date() })
      .where(eq(album.id, data.albumId))
    await invalidateCachedDetailCore(data.albumId)

    return { success: true }
  })

export const removeMemberFn = createServerFn({ method: 'POST' })
  .validator(RemoveMemberSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { albumMember, user } = await import('@/db/schema')
    const { and, eq, sql } = await import('drizzle-orm')
    const { resolveAlbumAccess, invalidateCachedDetailCore } =
      await import('./server')

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

    const removedUser = await database
      .select({
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
      })
      .from(user)
      .where(eq(user.id, data.userId))
      .get()

    await database
      .delete(albumMember)
      .where(
        and(
          eq(albumMember.albumId, data.albumId),
          eq(albumMember.userId, data.userId)
        )
      )

    await database
      .update(user)
      .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
      .where(eq(user.id, data.userId))
    await invalidateCachedDetailCore(data.albumId)

    if (currentUser) {
      const [{ logAlbumActivityByUser }, { formatUserDisplayName }] =
        await Promise.all([
          import('@/lib/telegram/logging'),
          import('@/lib/utils'),
        ])
      await logAlbumActivityByUser(currentUser.id, {
        albumId: data.albumId,
        albumTitle: row.title,
        action: 'member_removed',
        details: removedUser
          ? [
              `👤 Removed: ${formatUserDisplayName({
                firstName: removedUser.firstName ?? undefined,
                lastName: removedUser.lastName ?? undefined,
                name: removedUser.name ?? undefined,
                telegramUsername: removedUser.telegramUsername ?? undefined,
              })}`,
            ]
          : undefined,
      })
    }

    return { success: true }
  })
