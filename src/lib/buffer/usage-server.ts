import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { deleteState, readState, writeState } from '@/lib/app-state'
import { bufferGrant } from '@/db/schema'
import { loadSettings } from '@/lib/booking/load-settings'
import { getDriveStorageQuota } from '@/lib/google/google-drive'
import type { Budget } from '@/lib/cron/budget'
import { formatGb } from '@/lib/flamekeeper/rules'
import { sendAdminsTelegramResult } from '@/lib/pool/server'
import {
  forgetBufferGrantRows,
  getBufferPlan,
  listBufferGrants,
  setBufferGrantState,
} from './grant'
import { bufferStateAlertText } from './grant-rules'
import { getBufferAccessToken } from './tokens'
import { withBufferToken } from './tokens'
import {
  buildBufferOverview,
  planBufferAlert,
  planUsageWrite,
  type BufferMarker,
  type BufferOverview,
  type BufferUsage,
} from './usage'

const USAGE_KEY = 'buffer:usage'
const MARKER_KEY = 'buffer:alert'
const USAGE_TTL_SECONDS = 24 * 60 * 60
const CRON_REFRESH_MS = 50 * 60 * 1000
const REFRESH_COST = 4

export interface CachedBufferUsage extends BufferUsage {
  checkedAt: number
}

export async function readBufferUsage(): Promise<CachedBufferUsage | null> {
  try {
    const raw = await readState(USAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedBufferUsage>
    if (
      typeof parsed.usedBytes !== 'number' ||
      typeof parsed.checkedAt !== 'number'
    ) {
      return null
    }
    return {
      usedBytes: parsed.usedBytes,
      limitBytes:
        typeof parsed.limitBytes === 'number' ? parsed.limitBytes : null,
      checkedAt: parsed.checkedAt,
    }
  } catch (error) {
    console.warn('Failed to read buffer usage cache:', error)
    return null
  }
}

let lastUsage: CachedBufferUsage | null = null

export async function refreshBufferUsage(): Promise<CachedBufferUsage> {
  const quota = await withBufferToken((token) => getDriveStorageQuota(token))
  const usage: CachedBufferUsage = {
    usedBytes: quota.usageBytes,
    limitBytes: quota.limitBytes,
    checkedAt: Date.now(),
  }
  const previous = await readBufferUsage()
  lastUsage = usage
  if (!planUsageWrite(previous, usage)) return usage
  try {
    await writeState(USAGE_KEY, JSON.stringify(usage), USAGE_TTL_SECONDS)
  } catch (error) {
    console.warn('Failed to cache buffer usage:', error)
  }
  return usage
}

/** Cached usage, refreshed from Drive when older than `maxAgeMs`. */
export async function getBufferUsage(
  maxAgeMs: number
): Promise<CachedBufferUsage | null> {
  const stored = await readBufferUsage()
  const cached =
    lastUsage && (!stored || lastUsage.checkedAt > stored.checkedAt)
      ? lastUsage
      : stored
  if (cached && Date.now() - cached.checkedAt < maxAgeMs) return cached
  if ((await getBufferPlan()).kind === 'unavailable') return cached
  try {
    return await refreshBufferUsage()
  } catch (error) {
    console.warn('Failed to read buffer usage:', error)
    return cached
  }
}

async function readMarker(): Promise<BufferMarker | null> {
  const value = await readState(MARKER_KEY)
  return value === 'warn' || value === 'full' ? value : null
}

export interface BufferLimitSettings {
  bufferLimitBytes: number
  bufferAlertPercent: number
}

export async function loadBufferLimitSettings(
  database: ReturnType<typeof db>
): Promise<BufferLimitSettings> {
  const row = await loadSettings(database)
  return {
    bufferLimitBytes: row.bufferLimitBytes,
    bufferAlertPercent: row.bufferAlertPercent,
  }
}

async function workerDatabase(): Promise<ReturnType<typeof db>> {
  const { env } = await import('cloudflare:workers')
  return db(env.meriksirat_d1 as D1Database)
}

export async function toBufferOverview(
  usage: BufferUsage
): Promise<BufferOverview> {
  return buildBufferOverview(
    usage,
    await loadBufferLimitSettings(await workerDatabase())
  )
}

export async function getBufferOverview(
  maxAgeMs: number
): Promise<(BufferOverview & { checkedAt: number }) | null> {
  const usage = await getBufferUsage(maxAgeMs)
  if (!usage) return null
  return { ...(await toBufferOverview(usage)), checkedAt: usage.checkedAt }
}

function alertText(overview: BufferOverview, alertPercent: number): string {
  const used = formatGb(overview.usedBytes)
  const configured = formatGb(overview.configuredLimitBytes)
  const available =
    overview.availableLimitBytes === null
      ? 'unknown'
      : formatGb(overview.availableLimitBytes)
  const limits = `Configured limit ${configured}, available in Drive ${available}.`
  if (overview.level === 'full') {
    return `#savenuimg buffer is full (${used} used). ${limits} Uploads are paused until space is freed or the limit is raised.`
  }
  return `#savenuimg buffer passed ${alertPercent}% (${used} used, ${overview.percent}% of the configured limit). ${limits} Uploads stop when it is full. Schedule albums for deletion, recruit flamekeepers or raise the limit.`
}

/** Hourly step: warn admins once each time the buffer crosses 90% or 100%. */
export async function runBufferUsageCheck(
  env: {
    meriksirat_d1: D1Database
    TELEGRAM_BOT_TOKEN?: string
  },
  budget: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  await checkBufferState(env, database, budget)
  if ((await getBufferPlan(database)).kind === 'unavailable') return

  let usage = await readBufferUsage()
  if (!usage || Date.now() - usage.checkedAt >= CRON_REFRESH_MS) {
    if (!budget.take(REFRESH_COST)) return
    try {
      usage = await refreshBufferUsage()
    } catch (error) {
      console.warn('Failed to refresh buffer usage:', error)
      return
    }
  }

  const limits = await loadBufferLimitSettings(database)
  const overview = buildBufferOverview(usage, limits)
  const grants = await listBufferGrants(database)
  const live = grants.find((g) => g.status === 'active')
  if (live) {
    if (overview.level === 'full') {
      await setBufferGrantState(live.id, 'quota_full', database)
    } else if (live.state === 'quota_full') {
      await setBufferGrantState(live.id, 'ok', database)
    }
  }
  const marker = await readMarker()
  const plan = planBufferAlert(overview.level, marker)
  if (plan.notify) {
    const result = await sendAdminsTelegramResult(
      database,
      env.TELEGRAM_BOT_TOKEN,
      alertText(overview, limits.bufferAlertPercent),
      budget
    )
    if (result !== 'sent') return
  }
  if (plan.marker === marker) return
  if (plan.marker) await writeState(MARKER_KEY, plan.marker, null)
  else await deleteState(MARKER_KEY)
}

async function checkBufferState(
  env: {
    meriksirat_d1: D1Database
    TELEGRAM_BOT_TOKEN?: string
  },
  database: ReturnType<typeof db>,
  budget: Budget
): Promise<void> {
  const grants = (await listBufferGrants(database)).filter(
    (g) => g.status !== 'retiring'
  )
  for (const grant of grants) {
    if (grant.state === 'auth_failed' && budget.take(1)) {
      try {
        await getBufferAccessToken(grant.id)
      } catch {
        // still failing
      }
    }
  }
  const fresh = (await listBufferGrants(database)).filter(
    (g) => g.status !== 'retiring'
  )
  for (const grant of fresh) {
    if (grant.state === 'ok' || grant.alertedState === grant.state) continue
    if (!budget.take(2)) return
    const result = await sendAdminsTelegramResult(
      database,
      env.TELEGRAM_BOT_TOKEN,
      bufferStateAlertText(grant.state, grant.email),
      budget
    )
    if (result !== 'sent') continue
    await database
      .update(bufferGrant)
      .set({ alertedState: grant.state })
      .where(eq(bufferGrant.id, grant.id))
    forgetBufferGrantRows()
  }
}
