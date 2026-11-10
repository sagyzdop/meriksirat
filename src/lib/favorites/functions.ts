import { createServerFn } from '@tanstack/react-start'
import { AlbumIdSchema } from '@/lib/albums/types'
import { SetAlbumHeartSchema, SetFavoriteSchema } from './types'
import type { FavoriteRef } from './logic'
import type { AlbumSummary } from '@/lib/albums/types'
import type { FavoritePhoto } from './types'
import { UserError } from '@/lib/user-error'

async function sessionAndDb(headers: Headers) {
  const { getSessionUser } = await import('@/lib/albums/server')
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')
  return {
    sessionUser: await getSessionUser(headers),
    database: db(env.meriksirat_d1 as D1Database),
  }
}

async function requireFavoriter(headers: Headers) {
  const { database, sessionUser } = await sessionAndDb(headers)
  if (!sessionUser) throw new UserError('Sign in to favorite photos')
  const { loadAccessRules } = await import('@/lib/access/server')
  const rules = await loadAccessRules(database, sessionUser.id).catch(
    () => null
  )
  if (!rules) throw new UserError('Sign in to favorite photos')
  if (!rules.canFavorite) throw new UserError('You cannot favorite photos')
  return { database, sessionUser }
}

async function requireFavoriteWrite(headers: Headers) {
  const context = await requireFavoriter(headers)
  const { rateLimit } = await import('@/lib/ratelimit')
  const limit = await rateLimit(headers, 'rl_favorites', context.sessionUser.id)
  if (!limit.allowed) {
    throw new UserError(
      `Too many favorites. Try again in ${limit.retryAfterSeconds} seconds.`
    )
  }
  return context
}

export const getAlbumFavoritesFn = createServerFn({ method: 'GET' })
  .validator(AlbumIdSchema)
  .handler(async ({ data }): Promise<FavoriteRef[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { favorite } = await import('@/db/schema')
    const { and, eq } = await import('drizzle-orm')

    const { database, sessionUser } = await sessionAndDb(getRequestHeaders())
    if (!sessionUser) return []
    return database
      .select({ driveFileId: favorite.driveFileId })
      .from(favorite)
      .where(
        and(
          eq(favorite.userId, sessionUser.id),
          eq(favorite.albumId, data.albumId)
        )
      )
      .all()
  })

export const setFavoriteFn = createServerFn({ method: 'POST' })
  .validator(SetFavoriteSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { album, favorite } = await import('@/db/schema')
    const { and, eq, sql } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const { database, sessionUser } = await requireFavoriteWrite(headers)

    const albumRow = await database
      .select()
      .from(album)
      .where(eq(album.id, data.albumId))
      .get()
    if (!albumRow) throw new UserError('Album not found')

    if (data.favorite) {
      const { loadAlbumListing } = await import('@/lib/albums/listing-server')
      const listing = await loadAlbumListing(database, albumRow)
      if (
        listing.complete &&
        !listing.files.some((f) => f.id === data.driveFileId)
      ) {
        throw new UserError('Photo not found in this album')
      }
    }

    const isFavorited = sql`EXISTS (SELECT 1 FROM ${favorite} WHERE ${favorite.userId} = ${sessionUser.id} AND ${favorite.albumId} = ${albumRow.id} AND ${favorite.driveFileId} = ${data.driveFileId})`

    if (data.favorite) {
      await database.batch([
        database
          .update(album)
          .set({ favoriteCount: sql`${album.favoriteCount} + 1` })
          .where(and(eq(album.id, albumRow.id), sql`NOT ${isFavorited}`)),
        database
          .insert(favorite)
          .values({
            userId: sessionUser.id,
            albumId: albumRow.id,
            driveFileId: data.driveFileId,
          })
          .onConflictDoNothing(),
      ])
    } else {
      await database.batch([
        database
          .update(album)
          .set({ favoriteCount: sql`MAX(${album.favoriteCount} - 1, 0)` })
          .where(and(eq(album.id, albumRow.id), isFavorited)),
        database
          .delete(favorite)
          .where(
            and(
              eq(favorite.userId, sessionUser.id),
              eq(favorite.albumId, albumRow.id),
              eq(favorite.driveFileId, data.driveFileId)
            )
          ),
      ])
    }
    return { driveFileId: data.driveFileId, favorite: data.favorite }
  })

const FAVORITE_LIST_LIMIT = 1000
const FAVORITE_ALBUM_READS = 20

export const listMyFavoritesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FavoritePhoto[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { album, favorite } = await import('@/db/schema')
    const { and, desc, eq, isNull } = await import('drizzle-orm')
    const { loadListingEntry } = await import('@/lib/albums/listing-store')
    const { albumsToRead, planFavoriteList } = await import('./remap')

    const { database, sessionUser } =
      await requireFavoriter(getRequestHeaders())

    const rows = await database
      .select({
        albumId: album.id,
        albumTitle: album.title,
        driveFolderId: album.driveFolderId,
        driveFileId: favorite.driveFileId,
        favoritedAt: favorite.createdAt,
      })
      .from(favorite)
      .innerJoin(album, eq(album.id, favorite.albumId))
      .where(and(eq(favorite.userId, sessionUser.id), isNull(album.deletedAt)))
      .orderBy(desc(favorite.createdAt))
      .limit(FAVORITE_LIST_LIMIT)
      .all()

    const listings: Parameters<typeof planFavoriteList>[0]['listings'] = {}
    await Promise.all(
      albumsToRead(rows, FAVORITE_ALBUM_READS).map(async (albumId) => {
        const entry = await loadListingEntry(database, albumId)
        if (!entry) return
        const sources = Object.values(entry.sources)
        listings[albumId] = {
          complete:
            entry.folderState === 'ok' &&
            sources.length > 0 &&
            sources.every((s) => s.status === 'ok' || s.status === 'missing'),
          files: sources.flatMap((s) => s.files),
        }
      })
    )
    return planFavoriteList({ favorites: rows, listings })
  }
)

export const listHeartedAlbumIdsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { albumFavorite } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database, sessionUser } = await sessionAndDb(getRequestHeaders())
    if (!sessionUser) return []
    const rows = await database
      .select({ albumId: albumFavorite.albumId })
      .from(albumFavorite)
      .where(eq(albumFavorite.userId, sessionUser.id))
      .all()
    return rows.map((r) => r.albumId)
  }
)

export const listHeartedAlbumsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AlbumSummary[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { albumFavorite } = await import('@/db/schema')
    const { sql } = await import('drizzle-orm')
    const { listAlbumsPaginated } = await import('@/lib/albums/list')
    const { loadAccessRules } = await import('@/lib/access/server')

    const { database, sessionUser } = await sessionAndDb(getRequestHeaders())
    if (!sessionUser) return []
    const rules = await loadAccessRules(database, sessionUser.id).catch(
      () => null
    )
    if (!rules?.canFavorite) return []

    const page = await listAlbumsPaginated({
      database,
      me: sessionUser.id,
      baseWhere: sql`EXISTS (SELECT 1 FROM ${albumFavorite} WHERE ${albumFavorite.userId} = ${sessionUser.id} AND ${albumFavorite.albumId} = album.id)`,
      query: { limit: 100, cursor: null, search: '', ownership: [] },
    })
    return page.albums
  }
)

export const setAlbumHeartFn = createServerFn({ method: 'POST' })
  .validator(SetAlbumHeartSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { album, albumFavorite } = await import('@/db/schema')
    const { and, eq, isNull, sql } = await import('drizzle-orm')

    const { database, sessionUser } =
      await requireFavoriteWrite(getRequestHeaders())

    const albumRow = await database
      .select({ id: album.id })
      .from(album)
      .where(and(eq(album.id, data.albumId), isNull(album.deletedAt)))
      .get()
    if (!albumRow) throw new UserError('Album not found')

    const isHearted = sql`EXISTS (SELECT 1 FROM ${albumFavorite} WHERE ${albumFavorite.userId} = ${sessionUser.id} AND ${albumFavorite.albumId} = ${albumRow.id})`

    if (data.hearted) {
      await database.batch([
        database
          .update(album)
          .set({ heartCount: sql`${album.heartCount} + 1` })
          .where(and(eq(album.id, albumRow.id), sql`NOT ${isHearted}`)),
        database
          .insert(albumFavorite)
          .values({ userId: sessionUser.id, albumId: albumRow.id })
          .onConflictDoNothing(),
      ])
    } else {
      await database.batch([
        database
          .update(album)
          .set({ heartCount: sql`MAX(${album.heartCount} - 1, 0)` })
          .where(and(eq(album.id, albumRow.id), isHearted)),
        database
          .delete(albumFavorite)
          .where(
            and(
              eq(albumFavorite.userId, sessionUser.id),
              eq(albumFavorite.albumId, albumRow.id)
            )
          ),
      ])
    }
    return { albumId: albumRow.id, hearted: data.hearted }
  })
