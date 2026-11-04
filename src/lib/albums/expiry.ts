import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import {
  album,
  albumMember,
  bufferVolume,
  flamekeeper,
  photo,
  user,
  volume,
} from '@/db/schema'
import {
  DriveAppNotAuthorizedError,
  DriveNotFoundError,
  deleteDriveFile,
} from '@/lib/google/google-drive'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import { planExpiry, reminderRecipients } from '@/lib/pool/expiry'
import {
  RUN_SUBREQUEST_BUDGET,
  createBudget,
  takeIfBudgeted,
  type Budget,
} from '@/lib/cron/budget'
import type { TombstoneReason } from '@/lib/pool/expiry'
import { invalidateCachedDetailCore, invalidateCachedListing } from './server'
import { formatLongDate } from '@/lib/club-time'
import { chunk } from '@/lib/utils'
import { siteOrigin } from '@/lib/format'

type AlbumRecord = typeof album.$inferSelect

const ROW_DELETE_CHUNK = 90
const EXPIRES_PER_RUN = 3
const MIN_ALBUM_COST = 8

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
  try {
    await deleteDriveFile(accessToken, row.driveFolderId)
  } catch (error) {
    if (error instanceof DriveNotFoundError) return
    if (error instanceof DriveAppNotAuthorizedError) {
      console.warn(
        `Album ${row.id} keeps its Drive folder: it still holds files the club account cannot delete`
      )
      const alerted = await alertBlockedAlbum(database, row.id, options.budget)
      if (!alerted) throw new AlbumDeletionDeferredError()
      return
    }
    if (options.strictDrive) throw error
    console.warn(
      'Failed to delete Drive folder, continuing with DB cleanup:',
      error
    )
  }
}

async function alertBlockedAlbum(
  database: Database,
  albumId: string,
  budget?: Budget
): Promise<boolean> {
  try {
    const { env } = await import('cloudflare:workers')
    const { sendAdminsTelegramResult } = await import('@/lib/pool/server')
    const { albumBlockedAlertText } = await import('@/lib/pool/volumes')
    const result = await sendAdminsTelegramResult(
      database,
      (env as { TELEGRAM_BOT_TOKEN?: string }).TELEGRAM_BOT_TOKEN,
      albumBlockedAlertText(albumId, 0),
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
  const budget = options.budget ?? createBudget(RUN_SUBREQUEST_BUDGET)
  const { tearDownAlbumFiles } = await import('./teardown-server')
  if ((await tearDownAlbumFiles(database, row, budget)) === 'retry') {
    throw new AlbumDeletionDeferredError()
  }
  await deleteAlbumFolder(database, row, accessToken, { ...options, budget })
  await invalidateCachedListing(row.driveFolderId)
  await invalidateCachedDetailCore(row.id)

  if (options.tombstone) {
    await database.delete(photo).where(eq(photo.albumId, row.id))
    await database.delete(volume).where(eq(volume.albumId, row.id))
    await database.delete(bufferVolume).where(eq(bufferVolume.albumId, row.id))
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

export async function tombstoneGoneAlbum(
  database: Database,
  row: Pick<AlbumRecord, 'id' | 'driveFolderId' | 'ownerUserId' | 'deletedAt'>
): Promise<void> {
  const held = await database
    .select({
      userId: photo.flamekeeperUserId,
      bytes: sql<number>`SUM(${photo.bytes})`,
    })
    .from(photo)
    .where(and(eq(photo.albumId, row.id), isNotNull(photo.flamekeeperUserId)))
    .groupBy(photo.flamekeeperUserId)
    .all()
  for (const { userId, bytes } of held) {
    if (!userId) continue
    await database
      .update(flamekeeper)
      .set({
        usedBytes: sql`MAX(${flamekeeper.usedBytes} - ${Number(bytes)}, 0)`,
        driveUsageBytes: sql`MAX(${flamekeeper.driveUsageBytes} - ${Number(bytes)}, 0)`,
      })
      .where(eq(flamekeeper.userId, userId))
  }
  await database.delete(photo).where(eq(photo.albumId, row.id))
  await database.delete(volume).where(eq(volume.albumId, row.id))
  await database.delete(bufferVolume).where(eq(bufferVolume.albumId, row.id))
  await database
    .update(album)
    .set({
      deletedAt: new Date(),
      tombstoneReason: 'folder_deleted',
      photoCount: 0,
      photoBytes: 0,
      coverFileId: null,
      updatedAt: new Date(),
    })
    .where(eq(album.id, row.id))
  await invalidateCachedListing(row.driveFolderId)
  await invalidateCachedDetailCore(row.id)
  if (!row.deletedAt) {
    await database
      .update(user)
      .set({ albumCount: sql`MAX(${user.albumCount} - 1, 0)` })
      .where(eq(user.id, row.ownerUserId))
  }
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
    const turn = Math.floor(now.getTime() / (60 * 60 * 1000))
    for (const id of rotateIds(plan.expire, turn)) {
      if (removed >= EXPIRES_PER_RUN) break
      try {
        if (budget && !budget.canAfford(MIN_ALBUM_COST)) continue
        if (!accessToken) {
          if (!takeIfBudgeted(budget, 1)) continue
          accessToken = await getGoogleAccessToken()
        }
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
