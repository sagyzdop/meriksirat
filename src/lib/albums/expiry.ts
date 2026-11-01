import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { album, favorite, photo, user, volume } from '@/db/schema'
import { DriveNotFoundError, deleteDriveFile } from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { planExpiry } from '@/lib/pool/expiry'
import {
  MAX_PHOTO_DELETES_PER_CALL,
  deleteOwnedPhotos,
  loadOwnedPhotos,
} from '@/lib/pool/server'
import type { TombstoneReason } from '@/lib/pool/expiry'
import { invalidateCachedDetailCore, invalidateCachedListing } from './server'

type Database = ReturnType<typeof db>
type AlbumRecord = typeof album.$inferSelect

const ROW_DELETE_CHUNK = 90

export async function dropPhotoRows(
  database: Database,
  albumId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  for (let i = 0; i < ids.length; i += ROW_DELETE_CHUNK) {
    await database
      .delete(photo)
      .where(inArray(photo.id, ids.slice(i, i + ROW_DELETE_CHUNK)))
  }
  await database
    .update(album)
    .set({
      photoCount: sql`(SELECT COUNT(*) FROM ${photo} WHERE ${photo.albumId} = ${albumId})`,
      photoBytes: sql`(SELECT COALESCE(SUM(${photo.bytes}), 0) FROM ${photo} WHERE ${photo.albumId} = ${albumId})`,
      favoriteCount: sql`(SELECT COUNT(*) FROM ${favorite} INNER JOIN ${photo} ON ${photo.id} = ${favorite.photoId} WHERE ${photo.albumId} = ${albumId})`,
    })
    .where(eq(album.id, albumId))
}

/**
 * Delete every flamekeeper-owned photo with its owner's token. Drive refuses
 * to delete a folder that still holds them (`appNotAuthorizedToChild`), so
 * this runs before the folder goes. Returns false when a lost flamekeeper's
 * photos remain, which keeps the folder alive (ADR-0008).
 */
async function removeOwnedPhotos(
  database: Database,
  albumId: string
): Promise<boolean> {
  const owned = await loadOwnedPhotos(database, albumId)
  if (owned.length === 0) return true
  const batch = owned.slice(0, MAX_PHOTO_DELETES_PER_CALL)
  const { deleted, lost, error } = await deleteOwnedPhotos(database, batch)
  await dropPhotoRows(
    database,
    albumId,
    [...deleted, ...lost].map((p) => p.id)
  )
  if (error) throw error
  if (owned.length > batch.length) {
    throw new Error(
      'This album is too large to delete in one go. Some photos were deleted; try again to continue.'
    )
  }
  return lost.length === 0
}

/**
 * The single album removal path. Deletes flamekeepers' photos with their
 * owners' tokens, then the Drive folder, clears caches and drops the owner's
 * album count. With a `tombstone` reason the album row is kept (photo rows
 * removed, totals zeroed) so its URL can explain why it is gone; without one
 * the row is deleted outright.
 */
export async function removeAlbum(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId' | 'ownerUserId' | 'deletedAt'>,
  accessToken: string,
  options: { tombstone?: TombstoneReason; strictDrive?: boolean } = {}
): Promise<void> {
  const folderDeletable = await removeOwnedPhotos(database, row.id)
  if (!folderDeletable) {
    console.warn(
      `Album ${row.id} keeps its Drive folder: a lost flamekeeper's photos are still in it`
    )
  } else {
    try {
      await deleteDriveFile(accessToken, row.driveFolderId)
    } catch (error) {
      if (!(error instanceof DriveNotFoundError)) {
        if (options.strictDrive) throw error
        console.warn(
          'Failed to delete Drive folder, continuing with DB cleanup:',
          error
        )
      }
    }
  }
  await invalidateCachedListing(row.driveFolderId)
  await invalidateCachedDetailCore(row.id)

  if (options.tombstone) {
    await database.delete(photo).where(eq(photo.albumId, row.id))
    await database.delete(volume).where(eq(volume.albumId, row.id))
    await database
      .update(album)
      .set({
        deletedAt: new Date(),
        tombstoneReason: options.tombstone,
        photoCount: 0,
        photoBytes: 0,
        coverFileId: null,
        updatedAt: new Date(),
      })
      .where(eq(album.id, row.id))
  } else {
    await database.delete(album).where(eq(album.id, row.id))
  }

  if (!row.deletedAt) {
    await database
      .update(user)
      .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
      .where(eq(user.id, row.ownerUserId))
  }
}

function formatDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Almaty',
      })
    : ''
}

export async function runAlbumExpiry(env: {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  const rows = await database
    .select({
      id: album.id,
      title: album.title,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      expiresAt: album.expiresAt,
      pinned: album.pinned,
      deletedAt: album.deletedAt,
      expiryReminder30SentAt: album.expiryReminder30SentAt,
      expiryReminder7SentAt: album.expiryReminder7SentAt,
    })
    .from(album)
    .where(and(isNull(album.deletedAt), eq(album.pinned, false)))
    .all()

  const plan = planExpiry(rows, now)
  if (
    plan.expire.length === 0 &&
    plan.remind30.length === 0 &&
    plan.remind7.length === 0
  ) {
    return
  }
  const byId = new Map(rows.map((r) => [r.id, r]))

  const botToken = env.TELEGRAM_BOT_TOKEN
  if (botToken) {
    const { TelegramAPI } = await import('@/lib/telegram/api')
    const telegram = new TelegramAPI(botToken)
    const origin = (env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')

    const reminders = [
      { ids: plan.remind30, days: 30, column: 'expiryReminder30SentAt' },
      { ids: plan.remind7, days: 7, column: 'expiryReminder7SentAt' },
    ] as const

    for (const { ids, days, column } of reminders) {
      for (const id of ids) {
        const row = byId.get(id)!
        try {
          const owner = await database
            .select({ chatId: user.telegramChatId })
            .from(user)
            .where(eq(user.id, row.ownerUserId))
            .get()
          if (owner?.chatId) {
            const link = origin ? `\n${origin}/albums/${id}` : ''
            await telegram.sendMessage(
              owner.chatId,
              `Your album "${row.title}" will be deleted in ${days} days, on ${formatDate(row.expiresAt)}. There is no backup, so download the photos you want to keep.${link}`
            )
          }
          await database
            .update(album)
            .set({ [column]: now })
            .where(eq(album.id, id))
        } catch (error) {
          console.error(`Failed to send ${days}-day reminder for ${id}:`, error)
        }
      }
    }
  } else if (plan.remind30.length + plan.remind7.length > 0) {
    console.warn('TELEGRAM_BOT_TOKEN not configured, skipping expiry reminders')
  }

  if (plan.expire.length > 0) {
    const accessToken = await getGoogleAccessToken()
    for (const id of plan.expire) {
      try {
        await removeAlbum(database, byId.get(id)!, accessToken, {
          tombstone: 'expired',
          strictDrive: true,
        })
      } catch (error) {
        console.error(`Failed to expire album ${id}:`, error)
      }
    }
  }
}
