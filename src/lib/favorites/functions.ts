import { createServerFn } from '@tanstack/react-start'
import { GetAlbumFavoritesSchema, SetFavoriteSchema } from './types'
import type { FavoriteRef } from './logic'
import type { FavoritePhoto } from './types'

async function requireFavoriter(headers: Headers) {
  const { getSessionUser } = await import('@/lib/albums/server')
  const sessionUser = await getSessionUser(headers)
  if (!sessionUser) throw new Error('Sign in to favorite photos')
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')
  const { loadAccessRules } = await import('@/lib/access/server')
  const database = db(env.meriksirat_d1 as D1Database)
  const rules = await loadAccessRules(database, sessionUser.id).catch(
    () => null
  )
  if (!rules) throw new Error('Sign in to favorite photos')
  if (!rules.canFavorite) throw new Error('You cannot favorite photos')
  return { database, sessionUser }
}

export const getAlbumFavoritesFn = createServerFn({ method: 'GET' })
  .validator(GetAlbumFavoritesSchema)
  .handler(async ({ data }): Promise<FavoriteRef[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { favorite, photo } = await import('@/db/schema')
    const { and, eq } = await import('drizzle-orm')
    const { getSessionUser } = await import('@/lib/albums/server')

    const sessionUser = await getSessionUser(getRequestHeaders())
    if (!sessionUser) return []
    const database = db(env.meriksirat_d1 as D1Database)
    return database
      .select({ photoId: photo.id, driveFileId: photo.driveFileId })
      .from(favorite)
      .innerJoin(photo, eq(photo.id, favorite.photoId))
      .where(
        and(
          eq(favorite.userId, sessionUser.id),
          eq(photo.albumId, data.albumId)
        )
      )
      .all()
  })

export const setFavoriteFn = createServerFn({ method: 'POST' })
  .validator(SetFavoriteSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { album, favorite, photo } = await import('@/db/schema')
    const { and, eq, sql } = await import('drizzle-orm')
    const { resolveAlbumAccess } = await import('@/lib/albums/server')

    const headers = getRequestHeaders()
    const { database, sessionUser } = await requireFavoriter(headers)

    const albumRow = await database
      .select()
      .from(album)
      .where(eq(album.id, data.albumId))
      .get()
    if (!albumRow) throw new Error('Album not found')
    const { access } = await resolveAlbumAccess(headers, albumRow)
    if (!albumRow.isShared && access === 'none') {
      throw new Error('Album not found')
    }

    const findPhoto = () =>
      database
        .select({ id: photo.id })
        .from(photo)
        .where(
          and(
            eq(photo.albumId, albumRow.id),
            eq(photo.state, 'live'),
            data.photoId
              ? eq(photo.id, data.photoId)
              : eq(photo.driveFileId, data.driveFileId)
          )
        )
        .get()

    let photoRow = await findPhoto()
    if (
      !photoRow &&
      !data.photoId &&
      !albumRow.photosIndexedAt &&
      data.favorite
    ) {
      const { registerDriveFileById } = await import('@/lib/albums/photo-index')
      const { getGoogleAccessToken } =
        await import('@/lib/google/google-calendar-auth')
      await registerDriveFileById(
        database,
        await getGoogleAccessToken(),
        albumRow,
        data.driveFileId
      )
      photoRow = await findPhoto()
    }
    if (!photoRow) throw new Error('Photo not found in this album')

    const isFavorited = sql`EXISTS (SELECT 1 FROM ${favorite} WHERE ${favorite.userId} = ${sessionUser.id} AND ${favorite.photoId} = ${photoRow.id})`

    if (data.favorite) {
      await database.batch([
        database
          .update(album)
          .set({ favoriteCount: sql`${album.favoriteCount} + 1` })
          .where(and(eq(album.id, albumRow.id), sql`NOT ${isFavorited}`)),
        database
          .insert(favorite)
          .values({ userId: sessionUser.id, photoId: photoRow.id })
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
              eq(favorite.photoId, photoRow.id)
            )
          ),
      ])
    }
    return { photoId: photoRow.id, favorite: data.favorite }
  })

export const listMyFavoritesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FavoritePhoto[]> => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { album, albumMember, favorite, photo } = await import('@/db/schema')
    const { and, desc, eq, or, sql } = await import('drizzle-orm')
    const { photoRowToAlbumPhoto } = await import('@/lib/albums/photo-backfill')
    const { isManagerRole } = await import('@/lib/albums/server')

    const { database, sessionUser } =
      await requireFavoriter(getRequestHeaders())

    const visible = isManagerRole(sessionUser)
      ? undefined
      : or(
          eq(album.isShared, true),
          eq(album.ownerUserId, sessionUser.id),
          sql`EXISTS (SELECT 1 FROM ${albumMember} WHERE ${albumMember.albumId} = ${album.id} AND ${albumMember.userId} = ${sessionUser.id})`
        )

    const rows = await database
      .select({
        photo,
        albumId: album.id,
        albumTitle: album.title,
        favoritedAt: favorite.createdAt,
      })
      .from(favorite)
      .innerJoin(photo, eq(photo.id, favorite.photoId))
      .innerJoin(album, eq(album.id, photo.albumId))
      .where(
        and(
          eq(favorite.userId, sessionUser.id),
          eq(photo.state, 'live'),
          visible
        )
      )
      .orderBy(desc(favorite.createdAt))
      .limit(1000)
      .all()

    return rows.map((r) => ({
      ...photoRowToAlbumPhoto(r.photo),
      albumId: r.albumId,
      albumTitle: r.albumTitle,
      favoritedAt: r.favoritedAt.toISOString(),
    }))
  }
)
