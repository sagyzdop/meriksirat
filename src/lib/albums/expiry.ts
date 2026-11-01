import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { album, albumMember, favorite, photo, user, volume } from '@/db/schema'
import { DriveNotFoundError, deleteDriveFile } from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { planExpiry, reminderRecipients } from '@/lib/pool/expiry'
import {
  albumRemovalCost,
  takeIfBudgeted,
  type Budget,
} from '@/lib/cron/budget'
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
const EXPIRES_PER_RUN = 3

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
      photoCount: sql`(SELECT COUNT(*) FROM ${photo} WHERE ${photo.albumId} = ${albumId} AND ${photo.state} = 'live')`,
      photoBytes: sql`(SELECT COALESCE(SUM(${photo.bytes}), 0) FROM ${photo} WHERE ${photo.albumId} = ${albumId} AND ${photo.state} = 'live')`,
      favoriteCount: sql`(SELECT COUNT(*) FROM ${favorite} INNER JOIN ${photo} ON ${photo.id} = ${favorite.photoId} WHERE ${photo.albumId} = ${albumId} AND ${photo.state} = 'live')`,
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

async function removalCost(
  database: Database,
  albumId: string
): Promise<number> {
  const owners = await database
    .select({ n: sql<number>`COUNT(*)` })
    .from(photo)
    .where(and(eq(photo.albumId, albumId), isNotNull(photo.flamekeeperUserId)))
    .groupBy(photo.flamekeeperUserId)
    .all()
  return albumRemovalCost(owners.map((o) => Number(o.n)))
}

export async function runAlbumExpiry(
  env: {
    meriksirat_d1: D1Database
    TELEGRAM_BOT_TOKEN?: string
    BETTER_AUTH_URL?: string
  },
  budget?: Budget
): Promise<void> {
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

  if (plan.expire.length > 0) {
    let accessToken: string | null = null
    let removed = 0
    for (const id of plan.expire) {
      if (removed >= EXPIRES_PER_RUN) break
      try {
        const cost = (await removalCost(database, id)) + (accessToken ? 0 : 1)
        if (!takeIfBudgeted(budget, cost)) continue
        accessToken ??= await getGoogleAccessToken()
        removed++
        await removeAlbum(database, byId.get(id)!, accessToken, {
          tombstone: 'expired',
          strictDrive: true,
        })
      } catch (error) {
        console.error(`Failed to expire album ${id}:`, error)
      }
    }
  }

  const botToken = env.TELEGRAM_BOT_TOKEN
  if (botToken) {
    const { TelegramAPI } = await import('@/lib/telegram/api')
    const telegram = new TelegramAPI(botToken)
    const origin = (env.BETTER_AUTH_URL ?? '').trim().replace(/\/+$/, '')

    const reminders = [
      { ids: plan.remind30, days: 30, column: 'expiryReminder30SentAt' },
      { ids: plan.remind7, days: 7, column: 'expiryReminder7SentAt' },
    ] as const

    const allIds = [...plan.remind30, ...plan.remind7]
    const ownerChat = new Map<string, string | null>()
    const memberChats = new Map<string, (string | null)[]>()
    for (let i = 0; i < allIds.length; i += ROW_DELETE_CHUNK) {
      const chunk = allIds.slice(i, i + ROW_DELETE_CHUNK)
      const owners = await database
        .select({ albumId: album.id, chatId: user.telegramChatId })
        .from(album)
        .innerJoin(user, eq(user.id, album.ownerUserId))
        .where(inArray(album.id, chunk))
        .all()
      for (const o of owners) ownerChat.set(o.albumId, o.chatId)
      const members = await database
        .select({ albumId: albumMember.albumId, chatId: user.telegramChatId })
        .from(albumMember)
        .innerJoin(user, eq(user.id, albumMember.userId))
        .where(inArray(albumMember.albumId, chunk))
        .all()
      for (const m of members) {
        const list = memberChats.get(m.albumId) ?? []
        list.push(m.chatId)
        memberChats.set(m.albumId, list)
      }
    }

    outer: for (const { ids, days, column } of reminders) {
      for (const id of ids) {
        const row = byId.get(id)!
        const recipients = reminderRecipients(
          ownerChat.get(id),
          memberChats.get(id) ?? []
        )
        if (!takeIfBudgeted(budget, recipients.length)) break outer
        try {
          const link = origin ? `\n${origin}/albums/${id}` : ''
          const text = `Your album "${row.title}" will be deleted in ${days} days, on ${formatDate(row.expiresAt)}. There is no backup, so download the photos you want to keep.${link}`
          let failed = 0
          for (const chatId of recipients) {
            try {
              await telegram.sendMessage(chatId, text)
            } catch (error) {
              failed++
              console.error(
                `Failed to send ${days}-day reminder for ${id}:`,
                error
              )
            }
          }
          if (recipients.length > 0 && failed === recipients.length) continue
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
}
