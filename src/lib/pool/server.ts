import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { flamekeeper, photo, settings, user } from '@/db/schema'
import { batchDeleteDriveFiles } from '@/lib/google/google-drive'
import {
  FlamekeeperGrantError,
  forgetFlamekeeperAccessToken,
  withFlamekeeperToken,
} from '@/lib/flamekeeper/tokens'
import { BUFFER_OWNER_ID } from '@/lib/buffer/plan'
import { withBufferToken } from '@/lib/buffer/tokens'
import { type Budget } from '@/lib/cron/budget'
import {
  DEFAULT_FLAMEKEEPER_CAP_BYTES,
  poolAlert,
  poolStats,
  type PoolFlamekeeper,
} from './placement'

export const MAX_PHOTO_DELETES_PER_CALL = 2000

export async function loadCapBytes(database: Database): Promise<number> {
  const row = await database
    .select({ cap: settings.flamekeeperCapBytes })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()
  return row?.cap ?? DEFAULT_FLAMEKEEPER_CAP_BYTES
}

export async function loadPoolFlamekeepers(
  database: Database
): Promise<PoolFlamekeeper[]> {
  return database
    .select({
      userId: flamekeeper.userId,
      state: flamekeeper.state,
      pledgedBytes: flamekeeper.pledgedBytes,
      usedBytes: flamekeeper.usedBytes,
      driveUsageBytes: flamekeeper.driveUsageBytes,
    })
    .from(flamekeeper)
    .where(inArray(flamekeeper.state, ['active', 'full']))
    .all()
}

export interface OwnedPhoto {
  id: string
  driveFileId: string
  bytes: number
  flamekeeperUserId: string | null
}

export async function deleteOwnedPhotos(
  database: Database,
  photos: OwnedPhoto[],
  budget?: Budget
): Promise<{ deleted: OwnedPhoto[]; lost: OwnedPhoto[]; error: unknown }> {
  const byOwner = new Map<string, OwnedPhoto[]>()
  for (const p of photos) {
    if (!p.flamekeeperUserId) continue
    const list = byOwner.get(p.flamekeeperUserId) ?? []
    list.push(p)
    byOwner.set(p.flamekeeperUserId, list)
  }

  const deleted: OwnedPhoto[] = []
  const lost: OwnedPhoto[] = []
  let failure: unknown = null

  for (const [ownerId, owned] of byOwner) {
    try {
      const deleteAll = (token: string) =>
        batchDeleteDriveFiles(
          token,
          owned.map((p) => p.driveFileId)
        )
      const failedIds = new Set(
        ownerId === BUFFER_OWNER_ID
          ? await withBufferToken(deleteAll, budget)
          : await withFlamekeeperToken(database, ownerId, deleteAll, budget)
      )
      for (const p of owned) {
        if (failedIds.has(p.driveFileId)) {
          failure ??= new Error('Some photos could not be deleted from Drive')
        } else {
          deleted.push(p)
        }
      }
    } catch (error) {
      const owner = await database
        .select({ state: flamekeeper.state })
        .from(flamekeeper)
        .where(eq(flamekeeper.userId, ownerId))
        .get()
      if (
        error instanceof FlamekeeperGrantError &&
        (!owner || owner.state === 'lost' || owner.state === 'drained')
      ) {
        lost.push(...owned)
      } else {
        forgetFlamekeeperAccessToken(ownerId)
        failure ??= error
      }
    }
  }

  await releaseOwnedBytes(database, deleted)
  return { deleted, lost, error: failure }
}

export function releaseOwnedBytesStatements(
  database: Database,
  photos: OwnedPhoto[]
) {
  const totals = new Map<string, number>()
  for (const p of photos) {
    if (!p.flamekeeperUserId) continue
    totals.set(
      p.flamekeeperUserId,
      (totals.get(p.flamekeeperUserId) ?? 0) + p.bytes
    )
  }
  return [...totals].map(([userId, bytes]) =>
    database
      .update(flamekeeper)
      .set({
        usedBytes: sql`MAX(${flamekeeper.usedBytes} - ${bytes}, 0)`,
        driveUsageBytes: sql`MAX(${flamekeeper.driveUsageBytes} - ${bytes}, 0)`,
      })
      .where(eq(flamekeeper.userId, userId))
  )
}

export async function releaseOwnedBytes(
  database: Database,
  photos: OwnedPhoto[]
): Promise<void> {
  const statements = releaseOwnedBytesStatements(database, photos)
  if (statements.length === 0) return
  await database.batch(statements as unknown as [(typeof statements)[0]])
}

export async function loadOwnedPhotos(
  database: Database,
  albumId: string
): Promise<OwnedPhoto[]> {
  return database
    .select({
      id: photo.id,
      driveFileId: photo.driveFileId,
      bytes: photo.bytes,
      flamekeeperUserId: photo.flamekeeperUserId,
    })
    .from(photo)
    .where(and(eq(photo.albumId, albumId), isNotNull(photo.flamekeeperUserId)))
    .limit(MAX_PHOTO_DELETES_PER_CALL + 1)
    .all()
}

export type AdminSendResult = 'sent' | 'no_admins' | 'over_budget'

export async function sendAdminsTelegramResult(
  database: Database,
  botToken: string | undefined,
  text: string,
  budget?: Budget,
  options: { force?: boolean } = {}
): Promise<AdminSendResult> {
  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN not configured, skipping admin alert')
    return 'sent'
  }
  const admins = await database
    .select({ chatId: user.telegramChatId })
    .from(user)
    .where(and(eq(user.role, 'admin'), isNotNull(user.telegramChatId)))
    .all()
  if (admins.length === 0) return 'no_admins'
  if (budget) {
    if (options.force) budget.spend(admins.length)
    else if (!budget.take(admins.length)) return 'over_budget'
  }
  const { TelegramAPI } = await import('@/lib/telegram/api')
  const telegram = new TelegramAPI(botToken)
  for (const admin of admins) {
    try {
      await telegram.sendMessage(admin.chatId!, text)
    } catch (error) {
      console.error('Failed to send admin alert:', error)
    }
  }
  return 'sent'
}

export async function runPoolMaintenance(
  env: {
    meriksirat_d1: D1Database
    TELEGRAM_BOT_TOKEN?: string
  },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  await database
    .update(flamekeeper)
    .set({ state: 'active', updatedAt: now })
    .where(eq(flamekeeper.state, 'full'))

  const [fks, cap, settingsRow] = await Promise.all([
    loadPoolFlamekeepers(database),
    loadCapBytes(database),
    database
      .select({ alertedAt: settings.poolLowAlertedAt })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get(),
  ])

  if (!settingsRow) return
  const stats = poolStats(fks, cap)
  const alert = poolAlert(stats, settingsRow.alertedAt)
  if (alert === 'alert') {
    const { formatGb } = await import('@/lib/flamekeeper/rules')
    const result = await sendAdminsTelegramResult(
      database,
      env.TELEGRAM_BOT_TOKEN,
      `#savenuimg pool is low: ${formatGb(stats.freeBytes)} free of ${formatGb(stats.pledgedBytes)} pledged across ${stats.flamekeepers} flamekeepers. Recruit flamekeepers or free up space.`,
      budget
    )
    if (result !== 'sent') return
    await database
      .update(settings)
      .set({ poolLowAlertedAt: now })
      .where(eq(settings.id, 'global'))
  } else if (alert === 'rearm') {
    await database
      .update(settings)
      .set({ poolLowAlertedAt: null })
      .where(eq(settings.id, 'global'))
  }
}
