import { eq, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { flamekeeper, user, volume } from '@/db/schema'
import { rescueAlbumVolume } from '@/lib/albums/storage-server'
import { planDrainStep } from '@/lib/albums/storage-plan'
import { getBufferOverview } from '@/lib/buffer/usage-server'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import { sendAdminsTelegramResult } from './server'
import { endFlamekeeping } from './stop-server'

const SETTLES_PER_RUN = 10
const ALBUMS_PER_FLAMEKEEPER = 3
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
    .select({ albumId: volume.albumId })
    .from(volume)
    .where(eq(volume.flamekeeperUserId, userId))
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

  for (const { userId, name } of draining) {
    if (!takeIfBudgeted(budget, 2)) break
    try {
      const albums = await heldAlbums(database, userId)
      let bufferFull = false
      if (albums.length > 0) {
        const overview = await getBufferOverview(OVERVIEW_MAX_AGE_MS)
        bufferFull = overview?.level === 'full'
      }
      const step = planDrainStep({
        heldVolumes: albums.length,
        bufferFull,
      })
      if (step.kind === 'finalize') {
        await endFlamekeeping(database, userId)
        continue
      }
      if (step.kind === 'pause') {
        await alertOncePerDay(
          database,
          env,
          userId,
          `#savenuimg: the buffer is full, so ${name}'s photos cannot be moved off their Drive. Their drain is paused and no photos were deleted. Free space or raise the buffer limit.`,
          budget
        )
        continue
      }
      for (const { albumId } of albums) {
        if (budget && !budget.canAfford(RESCUE_COST)) break
        const result = await rescueAlbumVolume(database, albumId, {
          budget,
          flamekeeperUserId: userId,
        })
        if (result.ok) continue
        await alertOncePerDay(
          database,
          env,
          userId,
          `#savenuimg: moving ${name}'s photos to the buffer is paused (${result.reason}). No photos were deleted; it retries on the next run.`,
          budget
        )
        break
      }
      if ((await heldCount(database, userId)) === 0) {
        await endFlamekeeping(database, userId)
      }
    } catch (error) {
      console.error(`Could not settle drain of ${userId}:`, error)
    }
  }
}
