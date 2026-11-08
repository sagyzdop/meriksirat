import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { flamekeeper, user, volume } from '@/db/schema'
import {
  cleanDroppedVolumes,
  rescueAlbumVolume,
} from '@/lib/albums/storage-server'
import { planDrainStep } from '@/lib/albums/storage-plan'
import { getBufferOverview } from '@/lib/buffer/usage-server'
import { createBudget, takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { sendAdminsTelegramResult } from './server'
import { endFlamekeeping } from './stop-server'

const SETTLES_PER_RUN = 10
const LOST_PER_RUN = 3
const ALBUMS_PER_FLAMEKEEPER = 3
const CLEANUPS_PER_RUN = 10
const ALERT_TTL_SECONDS = 24 * 60 * 60
const OVERVIEW_MAX_AGE_MS = 10 * 60 * 1000
const RESCUE_COST = 12

type DrainEnv = {
  meriksirat_d1: D1Database
  meriksirat_kv?: KVNamespace
  TELEGRAM_BOT_TOKEN?: string
}

async function alertOncePerDay(
  database: Database,
  env: DrainEnv,
  userId: string,
  text: string,
  budget?: Budget
): Promise<void> {
  const key = `drain-paused:${userId}`
  try {
    if (env.meriksirat_kv && (await env.meriksirat_kv.get(key))) return
  } catch (error) {
    console.warn('Could not read drain alert marker:', error)
  }
  const result = await sendAdminsTelegramResult(
    database,
    env.TELEGRAM_BOT_TOKEN,
    text,
    budget
  )
  if (result !== 'sent' || !env.meriksirat_kv) return
  try {
    await env.meriksirat_kv.put(key, '1', { expirationTtl: ALERT_TTL_SECONDS })
  } catch (error) {
    console.warn('Could not write drain alert marker:', error)
  }
}

async function heldAlbums(database: Database, userId: string) {
  return database
    .selectDistinct({ albumId: volume.albumId })
    .from(volume)
    .where(and(eq(volume.flamekeeperUserId, userId), isNull(volume.droppedAt)))
    .limit(ALBUMS_PER_FLAMEKEEPER)
    .all()
}

async function heldCount(database: Database, userId: string) {
  const row = await database
    .select({ n: sql<number>`count(*)` })
    .from(volume)
    .where(eq(volume.flamekeeperUserId, userId))
    .get()
  return row?.n ?? 0
}

async function rescueHeld(
  database: Database,
  env: DrainEnv,
  fk: { userId: string; name: string },
  budget: Budget | undefined,
  pausedText: (reason: string) => string
): Promise<void> {
  const albums = await heldAlbums(database, fk.userId)
  if (albums.length === 0) return
  const overview = await getBufferOverview(OVERVIEW_MAX_AGE_MS)
  const step = planDrainStep({
    heldVolumes: albums.length,
    bufferFull: overview?.level === 'full',
  })
  if (step.kind === 'pause') {
    await alertOncePerDay(
      database,
      env,
      fk.userId,
      `#savenuimg: the buffer is full, so ${fk.name}'s photos cannot be moved off their Drive. Nothing was deleted. Free space or raise the buffer limit.`,
      budget
    )
    return
  }
  for (const { albumId } of albums) {
    if (budget && !budget.canAfford(RESCUE_COST)) break
    const result = await rescueAlbumVolume(database, albumId, {
      budget,
      flamekeeperUserId: fk.userId,
    })
    if (result.ok) continue
    if (result.reason.startsWith('Out of budget')) break
    await alertOncePerDay(
      database,
      env,
      fk.userId,
      pausedText(result.reason),
      budget
    )
    break
  }
}

/**
 * Hourly: moves the photos of draining flamekeepers back to the buffer and
 * ends their flamekeeping once no volume row is left; copies the photos of
 * lost flamekeepers to the buffer while their files can still be read; and
 * removes what dropped volumes still hold (buffer originals after an offload,
 * flamekeeper originals after a rescue, abandoned partial copies).
 */
export async function runDrainMaintenance(
  env: DrainEnv,
  budget?: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const draining = await database
    .select({ userId: flamekeeper.userId, name: user.name })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .where(eq(flamekeeper.state, 'draining'))
    .limit(SETTLES_PER_RUN)
    .all()

  for (const fk of draining) {
    if (!takeIfBudgeted(budget, 2)) break
    try {
      await rescueHeld(
        database,
        env,
        fk,
        budget,
        (reason) =>
          `#savenuimg: moving ${fk.name}'s photos to the buffer is paused (${reason}). No photos were deleted; it retries on the next run.`
      )
      if (budget?.canAfford(4) ?? true) {
        await cleanDroppedVolumes(database, budget ?? createBudget(), {
          flamekeeperUserId: fk.userId,
        })
      }
      if ((await heldCount(database, fk.userId)) === 0) {
        await endFlamekeeping(database, fk.userId)
      }
    } catch (error) {
      console.error(`Could not settle drain of ${fk.userId}:`, error)
    }
  }

  const lost = await database
    .selectDistinct({ userId: flamekeeper.userId, name: user.name })
    .from(flamekeeper)
    .innerJoin(user, eq(user.id, flamekeeper.userId))
    .innerJoin(volume, eq(volume.flamekeeperUserId, flamekeeper.userId))
    .where(and(eq(flamekeeper.state, 'lost'), isNull(volume.droppedAt)))
    .limit(LOST_PER_RUN)
    .all()
  for (const fk of lost) {
    if (!takeIfBudgeted(budget, 2)) break
    try {
      await rescueHeld(
        database,
        env,
        fk,
        budget,
        (reason) =>
          `#savenuimg: ${fk.name} lost Drive access and copying their photos to the buffer failed (${reason}). It retries on the next run; if it keeps failing their photos drop out of the app after the grace period.`
      )
    } catch (error) {
      console.error(`Could not rescue lost flamekeeper ${fk.userId}:`, error)
    }
  }

  if (budget?.canAfford(4) ?? true) {
    try {
      await cleanDroppedVolumes(database, budget ?? createBudget(), {
        limit: CLEANUPS_PER_RUN,
      })
    } catch (error) {
      console.error('Could not clean dropped volumes:', error)
    }
  }
}
