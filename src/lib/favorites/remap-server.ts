import { and, eq, inArray, or, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, favorite } from '@/db/schema'
import { invalidatePublicAlbumList } from '@/lib/albums/server'
import { forgetAlbumListing } from '@/lib/albums/photo-store'
import { chunk } from '@/lib/utils'
import { planRemap } from './remap'

const USER_CHUNK = 90

/**
 * Re-points an album's favorites and cover from `oldFileId` to `newFileId`
 * after a photo moves to a new Drive file. Safe to repeat. Offloads
 * call this once per moved photo, after the new copy is verified.
 */
export async function remapDriveFile(
  database: Database,
  input: { albumId: string; oldFileId: string; newFileId: string }
): Promise<void> {
  const { albumId, oldFileId, newFileId } = input
  if (oldFileId === newFileId) return

  const [row, rows] = await Promise.all([
    database
      .select({
        driveFolderId: album.driveFolderId,
        coverFileId: album.coverFileId,
      })
      .from(album)
      .where(eq(album.id, albumId))
      .get(),
    database
      .select({ userId: favorite.userId, driveFileId: favorite.driveFileId })
      .from(favorite)
      .where(
        and(
          eq(favorite.albumId, albumId),
          or(
            eq(favorite.driveFileId, oldFileId),
            eq(favorite.driveFileId, newFileId)
          )
        )
      )
      .all(),
  ])
  if (!row) return

  const plan = planRemap({
    favorites: rows,
    coverFileId: row.coverFileId,
    oldFileId,
    newFileId,
  })

  const statements = [
    ...chunk(plan.move, USER_CHUNK).map((users) =>
      database
        .update(favorite)
        .set({ driveFileId: newFileId })
        .where(
          and(
            eq(favorite.albumId, albumId),
            eq(favorite.driveFileId, oldFileId),
            inArray(favorite.userId, users)
          )
        )
    ),
    database
      .delete(favorite)
      .where(
        and(eq(favorite.albumId, albumId), eq(favorite.driveFileId, oldFileId))
      ),
    database
      .update(album)
      .set({
        ...(plan.coverFileId !== row.coverFileId && {
          coverFileId: plan.coverFileId,
        }),
        favoriteCount: sql`(SELECT COUNT(*) FROM ${favorite} WHERE ${favorite.albumId} = ${albumId})`,
      })
      .where(eq(album.id, albumId)),
  ]
  await database.batch(statements as [(typeof statements)[number]])

  await Promise.all([
    forgetAlbumListing(albumId, database),
    plan.coverFileId !== row.coverFileId && invalidatePublicAlbumList(),
  ])
}
