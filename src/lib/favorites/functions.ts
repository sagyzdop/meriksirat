import { createServerFn } from '@tanstack/react-start'
import { AlbumIdSchema } from '@/lib/albums/types'
import { SetFavoriteSchema } from './types'
import type { FavoriteRef } from './logic'
import type { FavoritePhoto } from './types'

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
  if (!sessionUser) throw new Error('Sign in to favorite photos')
  const { loadAccessRules } = await import('@/lib/access/server')
  const rules = await loadAccessRules(database, sessionUser.id).catch(
    () => null
  )
  if (!rules) throw new Error('Sign in to favorite photos')
  if (!rules.canFavorite) throw new Error('You cannot favorite photos')
  return { database, sessionUser }
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
    const { database, sessionUser } = await requireFavoriter(headers)

    const albumRow = await database
      .select()
      .from(album)
      .where(eq(album.id, data.albumId))
      .get()
    if (!albumRow) throw new Error('Album not found')

    if (data.favorite) {
      const { loadAlbumListing } = await import('@/lib/albums/listing-server')
      const listing = await loadAlbumListing(database, albumRow)
      if (
        listing.complete &&
        !listing.files.some((f) => f.id === data.driveFileId)
      ) {
        throw new Error('Photo not found in this album')
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
    const { getCachedListing } = await import('@/lib/albums/server')
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

    const folderByAlbum = new Map(rows.map((r) => [r.albumId, r.driveFolderId]))
    const listings: Parameters<typeof planFavoriteList>[0]['listings'] = {}
    await Promise.all(
      albumsToRead(rows, FAVORITE_ALBUM_READS).map(async (albumId) => {
        const entry = await getCachedListing(folderByAlbum.get(albumId)!)
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
