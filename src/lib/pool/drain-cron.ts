import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { album, flamekeeper, user, volume } from '@/db/schema'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import { FlamekeeperGrantError } from '@/lib/flamekeeper/tokens'
import { formatGb } from '@/lib/flamekeeper/rules'
import { formatLongDate } from '@/lib/club-time'
import { dropPhotoRows, removeAlbum } from '@/lib/albums/expiry'
import { batchDeleteCost, takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { deleteOwnedPhotos, sendAdminsTelegramResult } from './server'
import { notifyAlbumTombstoned, type NoticeEnv } from './notices'
import {
  drainAdminAlertDue,
  drainBytesLeft,
  drainReminderDue,
  isDrainOverdue,
  pickDeadlineDeletions,
} from './drain'
import { abandonedAlertText, releaseAbandonedCutoff } from './volumes'

import {
  accountLink,
  advanceDrain,
  drainColumns,
  invalidateAlbumDetailIfCached,
  loadVolumePhotos,
  releaseEmptyVolumes,
  sendFlamekeeperEmail,
  type DrainRow,
} from './drain-server'

type Database = ReturnType<typeof db>

const DEADLINE_DELETES_PER_RUN = 200
const REMINDERS_PER_RUN = 2
const ADVANCES_PER_RUN = 2
const ADMIN_ALERTS_PER_RUN = 2
const DEADLINE_ALBUMS_PER_RUN = 3

function albumsOf(photos: { albumId: string }[]): number {
  return new Set(photos.map((p) => p.albumId)).size
}

function deadlineCost(photos: { albumId: string }[]): number {
  if (photos.length === 0) return 0
  return batchDeleteCost(photos.length) + 1 + 3 * albumsOf(photos)
}

async function deleteOverdue(
  database: Database,
  row: DrainRow,
  now: Date,
  env: NoticeEnv,
  budget?: Budget
): Promise<void> {
  const candidates = await loadVolumePhotos(
    database,
    row.userId,
    DEADLINE_DELETES_PER_RUN
  )
  const albumsSeen = new Set<string>()
  let picked = pickDeadlineDeletions(row, candidates).filter((p) => {
    if (albumsSeen.has(p.albumId)) return true
    if (albumsSeen.size >= DEADLINE_ALBUMS_PER_RUN) return false
    albumsSeen.add(p.albumId)
    return true
  })
  while (picked.length > 0 && !takeIfBudgeted(budget, deadlineCost(picked))) {
    picked = picked.slice(0, Math.floor(picked.length / 2))
  }
  if (picked.length > 0) {
    const { deleted, error } = await deleteOwnedPhotos(database, picked, budget)
    const byAlbum = new Map<string, string[]>()
    for (const p of picked) {
      if (!deleted.some((d) => d.id === p.id)) continue
      byAlbum.set(p.albumId, [...(byAlbum.get(p.albumId) ?? []), p.id])
    }
    for (const [albumId, ids] of byAlbum) {
      await dropPhotoRows(database, albumId, ids)
      await database
        .update(album)
        .set({ coverFileId: null })
        .where(
          and(
            eq(album.id, albumId),
            inArray(
              album.coverFileId,
              deleted
                .filter((d) => ids.includes(d.id))
                .map((d) => d.driveFileId)
            )
          )
        )
    }
    await tombstoneEmptyAlbums(database, [...byAlbum.keys()], env, budget)
    if (byAlbum.size > 0) {
      await releaseEmptyVolumes(database, row.userId, [...byAlbum.keys()])
    }
    if (error) {
      if (error instanceof FlamekeeperGrantError) {
        console.warn(
          `Drain deadline for ${row.userId}: Drive grant failed, retrying later`
        )
      } else {
        console.error(`Drain deadline for ${row.userId}:`, error)
      }
    }
  }
  await advanceDrain(database, row.userId, now, budget)
}

async function tombstoneEmptyAlbums(
  database: Database,
  albumIds: string[],
  env: NoticeEnv,
  budget?: Budget
): Promise<void> {
  if (albumIds.length === 0) return
  const empty = await database
    .select({
      id: album.id,
      title: album.title,
      driveFolderId: album.driveFolderId,
      ownerUserId: album.ownerUserId,
      deletedAt: album.deletedAt,
      photoCount: album.photoCount,
      photosIndexedAt: album.photosIndexedAt,
    })
    .from(album)
    .where(inArray(album.id, albumIds))
    .all()
  for (const a of empty) {
    if (a.deletedAt || a.photoCount > 0 || !a.photosIndexedAt) {
      await invalidateAlbumDetailIfCached(a.id)
      continue
    }
    try {
      await withGoogleToken(
        (masterToken) =>
          removeAlbum(database, a, masterToken, {
            tombstone: 'flamekeeper_left',
            budget,
          }),
        budget
      )
      await notifyAlbumTombstoned(database, env, a, 'flamekeeper_left')
    } catch (error) {
      console.error(`Failed to tombstone album ${a.id}:`, error)
    }
  }
}

function adminAlertText(
  kind: 'started' | 'reminder',
  who: string,
  row: DrainRow
): string {
  const left = formatGb(drainBytesLeft(row))
  const deadline = formatLongDate(row.drainingDeadline)
  if (kind === 'started') {
    return `#savenuimg drain started: ${who} (${row.drainReason ?? 'drain'}) has ${left} to move off. Deadline ${deadline}; photos still there then are deleted.`
  }
  return `#savenuimg drain deadline in 3 days: ${who} still holds ${left}. Photos left on ${deadline} are deleted. Move them or ask the flamekeeper to.`
}

async function alertAdminsOfDrains(
  database: Database,
  rows: DrainRow[],
  now: Date,
  botToken: string | undefined,
  budget?: Budget
): Promise<void> {
  let alerts = 0
  for (const row of rows) {
    if (alerts >= ADMIN_ALERTS_PER_RUN) break
    const due = drainAdminAlertDue(row, now)
    if (!due) continue
    alerts++
    const owner = await database
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, row.userId))
      .get()
    const who = owner ? `${owner.name} <${owner.email}>` : row.userId
    const result = await sendAdminsTelegramResult(
      database,
      botToken,
      adminAlertText(due, who, row),
      budget
    )
    if (result !== 'sent') return
    await database
      .update(flamekeeper)
      .set(
        due === 'started'
          ? { drainAdminStartedAt: now }
          : { drainAdminRemindedAt: now }
      )
      .where(eq(flamekeeper.userId, row.userId))
  }
}

async function alertAbandonedVolumes(
  database: Database,
  now: Date,
  botToken: string | undefined,
  budget?: Budget
): Promise<void> {
  const rows = await database
    .select({
      albumId: volume.albumId,
      userId: volume.flamekeeperUserId,
      title: album.title,
      name: user.name,
      email: user.email,
    })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .innerJoin(user, eq(user.id, volume.flamekeeperUserId))
    .where(
      and(
        isNull(volume.releaseAlertedAt),
        lte(volume.releaseFirstBlockedAt, releaseAbandonedCutoff(now))
      )
    )
    .orderBy(asc(volume.releaseFirstBlockedAt))
    .limit(ADMIN_ALERTS_PER_RUN)
    .all()
  for (const row of rows) {
    const result = await sendAdminsTelegramResult(
      database,
      botToken,
      abandonedAlertText(`${row.name} <${row.email}>`, row.title),
      budget
    )
    if (result !== 'sent') return
    await database
      .update(volume)
      .set({ releaseAlertedAt: now })
      .where(
        and(
          eq(volume.albumId, row.albumId),
          eq(volume.flamekeeperUserId, row.userId)
        )
      )
  }
}

export async function runDrainMaintenance(
  env: {
    meriksirat_d1: D1Database
    TELEGRAM_BOT_TOKEN?: string
    BETTER_AUTH_URL?: string
  },
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()

  await alertAbandonedVolumes(
    database,
    now,
    env.TELEGRAM_BOT_TOKEN,
    budget
  ).catch((error) => console.error('Abandoned volume alerts failed:', error))

  const rows = await database
    .select(drainColumns)
    .from(flamekeeper)
    .where(eq(flamekeeper.state, 'draining'))
    .all()
  if (rows.length === 0) return

  await alertAdminsOfDrains(database, rows, now, env.TELEGRAM_BOT_TOKEN, budget)

  let reminders = 0
  for (const row of rows) {
    if (row.drainReason === 'ban') continue
    if (reminders >= REMINDERS_PER_RUN || !drainReminderDue(row, now)) continue
    if (!takeIfBudgeted(budget, 1)) break
    reminders++
    const left = formatGb(drainBytesLeft(row))
    const sent = await sendFlamekeeperEmail(
      database,
      row.userId,
      '#savenuimg: your photos will be deleted soon',
      (name) =>
        `Hi ${name},\n\n${left} of club photos are still with you. On ${formatLongDate(row.drainingDeadline)} the photos that have not moved will be deleted. Open your account page and keep the tab open to move them now.${accountLink()}`
    )
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ drainReminderSentAt: now })
        .where(eq(flamekeeper.userId, row.userId))
    }
  }

  const overdue = rows.filter((row) => isDrainOverdue(row, now))
  const pick = overdue[Math.floor(Math.random() * overdue.length)]
  let advanced = 0
  for (const row of rows) {
    try {
      if (row === pick) {
        await deleteOverdue(database, row, now, env, budget)
      } else if (advanced < ADVANCES_PER_RUN) {
        const after = await advanceDrain(database, row.userId, now, budget)
        if (after?.state !== 'draining') advanced++
      }
    } catch (error) {
      console.error(`Drain maintenance failed for ${row.userId}:`, error)
    }
  }
}
