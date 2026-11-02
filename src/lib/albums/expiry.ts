import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { album, albumMember, favorite, photo, user, volume } from '@/db/schema'
import {
  DriveAppNotAuthorizedError,
  DriveNotFoundError,
  deleteDriveFile,
} from '@/lib/google/google-drive'
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
import type { HealTally } from '@/lib/pool/volumes'
import { invalidateCachedDetailCore, invalidateCachedListing } from './server'
import { formatLongDate } from '@/lib/club-time'
import { chunk } from '@/lib/utils'
import { siteOrigin } from '@/lib/format'

type AlbumRecord = typeof album.$inferSelect

const ROW_DELETE_CHUNK = 90
const EXPIRES_PER_RUN = 3

export const albumRecountSet = (albumId: string) => ({
  photoCount: sql`(SELECT COUNT(*) FROM ${photo} WHERE ${photo.albumId} = ${albumId} AND ${photo.state} = 'live')`,
  photoBytes: sql`(SELECT COALESCE(SUM(${photo.bytes}), 0) FROM ${photo} WHERE ${photo.albumId} = ${albumId} AND ${photo.state} = 'live')`,
  favoriteCount: sql`(SELECT COUNT(*) FROM ${favorite} INNER JOIN ${photo} ON ${photo.id} = ${favorite.photoId} WHERE ${photo.albumId} = ${albumId} AND ${photo.state} = 'live')`,
})

export async function dropPhotoRows(
  database: Database,
  albumId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  for (const part of chunk(ids, ROW_DELETE_CHUNK)) {
    await database.delete(photo).where(inArray(photo.id, part))
  }
  await database
    .update(album)
    .set(albumRecountSet(albumId))
    .where(eq(album.id, albumId))
}

async function removeOwnedPhotos(
  database: Database,
  albumId: string,
  budget?: Budget
): Promise<boolean> {
  const owned = await loadOwnedPhotos(database, albumId)
  if (owned.length === 0) return true
  const batch = owned.slice(0, MAX_PHOTO_DELETES_PER_CALL)
  const { deleted, lost, error } = await deleteOwnedPhotos(
    database,
    batch,
    budget
  )
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

export class AlbumDeletionDeferredError extends Error {
  constructor() {
    super(
      'This album is too large to delete in one go. Some photos were deleted; try again to continue.'
    )
    this.name = 'AlbumDeletionDeferredError'
  }
}

async function deleteAlbumFolder(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId'>,
  accessToken: string,
  options: { strictDrive?: boolean; budget?: Budget }
): Promise<void> {
  const { decideAlbumFolder } = await import('@/lib/pool/volumes')
  let tally: HealTally | null = null
  let retried = false
  while (true) {
    try {
      await deleteDriveFile(accessToken, row.driveFolderId)
      return
    } catch (error) {
      if (error instanceof DriveNotFoundError) return
      if (error instanceof DriveAppNotAuthorizedError) {
        if (!tally) {
          try {
            const { healAlbumVolumes } =
              await import('@/lib/pool/volumes-server')
            tally = await healAlbumVolumes(
              database,
              row.id,
              new Date(),
              options.budget
            )
          } catch (healError) {
            console.warn(
              `Could not clear volumes of album ${row.id}:`,
              healError
            )
            tally = { cleared: 0, blocked: 0, incomplete: 1 }
          }
        }
        const decision = decideAlbumFolder(tally, retried)
        if (decision === 'defer') throw new AlbumDeletionDeferredError()
        if (decision === 'retry') {
          if (!takeIfBudgeted(options.budget, 1)) {
            throw new AlbumDeletionDeferredError()
          }
          retried = true
          continue
        }
        console.warn(
          `Album ${row.id} keeps its Drive folder: it still holds photos the club account cannot delete (${tally.blocked} volumes could not be cleared)`
        )
        const alerted = await alertBlockedAlbum(
          database,
          row.id,
          tally.blocked,
          options.budget
        )
        if (!alerted) throw new AlbumDeletionDeferredError()
        return
      }
      if (options.strictDrive) throw error
      console.warn(
        'Failed to delete Drive folder, continuing with DB cleanup:',
        error
      )
      return
    }
  }
}

async function alertBlockedAlbum(
  database: Database,
  albumId: string,
  blocked: number,
  budget?: Budget
): Promise<boolean> {
  try {
    const { env } = await import('cloudflare:workers')
    const { sendAdminsTelegramResult } = await import('@/lib/pool/server')
    const { albumBlockedAlertText } = await import('@/lib/pool/volumes')
    const result = await sendAdminsTelegramResult(
      database,
      (env as { TELEGRAM_BOT_TOKEN?: string }).TELEGRAM_BOT_TOKEN,
      albumBlockedAlertText(albumId, blocked),
      budget
    )
    if (result === 'no_admins') {
      console.warn(`No admin to alert about album ${albumId}`)
    }
    return result !== 'over_budget'
  } catch (error) {
    console.warn(`Could not alert admins about album ${albumId}:`, error)
    return true
  }
}

export async function removeAlbum(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId' | 'ownerUserId' | 'deletedAt'>,
  accessToken: string,
  options: {
    tombstone?: TombstoneReason
    strictDrive?: boolean
    budget?: Budget
  } = {}
): Promise<void> {
  const folderDeletable = await removeOwnedPhotos(
    database,
    row.id,
    options.budget
  )
  if (!folderDeletable) {
    console.warn(
      `Album ${row.id} keeps its Drive folder: a lost flamekeeper's photos are still in it`
    )
  } else {
    await deleteAlbumFolder(database, row, accessToken, options)
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
    const { rotateIds } = await import('@/lib/pool/volumes')
    const turn = Math.floor(now.getTime() / (5 * 60 * 1000))
    for (const id of rotateIds(plan.expire, turn)) {
      if (removed >= EXPIRES_PER_RUN) break
      try {
        const cost = (await removalCost(database, id)) + (accessToken ? 0 : 1)
        if (!takeIfBudgeted(budget, cost)) continue
        accessToken ??= await getGoogleAccessToken()
        removed++
        await removeAlbum(database, byId.get(id)!, accessToken, {
          tombstone: 'expired',
          strictDrive: true,
          budget,
        })
      } catch (error) {
        if (error instanceof AlbumDeletionDeferredError) {
          console.warn(`Expiry of album ${id} deferred to a later run`)
          continue
        }
        console.error(`Failed to expire album ${id}:`, error)
      }
    }
  }

  const botToken = env.TELEGRAM_BOT_TOKEN
  if (botToken) {
    const { TelegramAPI } = await import('@/lib/telegram/api')
    const telegram = new TelegramAPI(botToken)
    const origin = siteOrigin(env.BETTER_AUTH_URL)

    const reminders = [
      { ids: plan.remind30, days: 30, column: 'expiryReminder30SentAt' },
      { ids: plan.remind7, days: 7, column: 'expiryReminder7SentAt' },
    ] as const

    const allIds = [...plan.remind30, ...plan.remind7]
    const ownerChat = new Map<string, string | null>()
    const memberChats = new Map<string, (string | null)[]>()
    for (const idPart of chunk(allIds, ROW_DELETE_CHUNK)) {
      const owners = await database
        .select({ albumId: album.id, chatId: user.telegramChatId })
        .from(album)
        .innerJoin(user, eq(user.id, album.ownerUserId))
        .where(inArray(album.id, idPart))
        .all()
      for (const o of owners) ownerChat.set(o.albumId, o.chatId)
      const members = await database
        .select({ albumId: albumMember.albumId, chatId: user.telegramChatId })
        .from(albumMember)
        .innerJoin(user, eq(user.id, albumMember.userId))
        .where(inArray(albumMember.albumId, idPart))
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
          const text = `Your album "${row.title}" will be deleted in ${days} days, on ${formatLongDate(row.expiresAt)}. There is no backup, so download the photos you want to keep.${link}`
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
