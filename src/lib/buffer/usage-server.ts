import { db } from '@/db'
import { getDriveStorageQuota } from '@/lib/google/google-drive'
import type { Budget } from '@/lib/cron/budget'
import { formatGb } from '@/lib/flamekeeper/rules'
import { sendAdminsTelegramResult } from '@/lib/pool/server'
import { planBufferUpload } from './plan'
import { withBufferToken } from './tokens'
import {
  bufferUsageLevel,
  planBufferAlert,
  usagePercent,
  type BufferMarker,
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

async function kv(): Promise<KVNamespace> {
  const { env } = await import('cloudflare:workers')
  return env.meriksirat_kv
}

export async function readBufferUsage(): Promise<CachedBufferUsage | null> {
  try {
    const raw = await (await kv()).get(USAGE_KEY)
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

export async function refreshBufferUsage(): Promise<CachedBufferUsage> {
  const quota = await withBufferToken((token) => getDriveStorageQuota(token))
  const usage: CachedBufferUsage = {
    usedBytes: quota.usageBytes,
    limitBytes: quota.limitBytes,
    checkedAt: Date.now(),
  }
  try {
    await (
      await kv()
    ).put(USAGE_KEY, JSON.stringify(usage), {
      expirationTtl: USAGE_TTL_SECONDS,
    })
  } catch (error) {
    console.warn('Failed to cache buffer usage:', error)
  }
  return usage
}

/** Cached usage, refreshed from Drive when older than `maxAgeMs`. */
export async function getBufferUsage(
  maxAgeMs: number
): Promise<CachedBufferUsage | null> {
  const cached = await readBufferUsage()
  if (cached && Date.now() - cached.checkedAt < maxAgeMs) return cached
  if (planBufferUpload(process.env).kind === 'unavailable') return cached
  try {
    return await refreshBufferUsage()
  } catch (error) {
    console.warn('Failed to read buffer usage:', error)
    return cached
  }
}

async function readMarker(store: KVNamespace): Promise<BufferMarker | null> {
  const value = await store.get(MARKER_KEY)
  return value === 'warn' || value === 'full' ? value : null
}

function alertText(usage: BufferUsage): string {
  const percent = usagePercent(usage)
  const used = formatGb(usage.usedBytes)
  const limit = usage.limitBytes ? formatGb(usage.limitBytes) : 'its limit'
  if (bufferUsageLevel(usage) === 'full') {
    return `#savenuimg buffer is full (${used} of ${limit}). Uploads are paused until space is freed. Use Free up space on the dashboard.`
  }
  return `#savenuimg buffer is ${percent}% full (${used} of ${limit}). Uploads stop at 100%. Free up space on the dashboard or recruit flamekeepers.`
}

/** Hourly step: warn admins once each time the buffer crosses 90% or 100%. */
export async function runBufferUsageCheck(
  env: {
    meriksirat_d1: D1Database
    meriksirat_kv: KVNamespace
    TELEGRAM_BOT_TOKEN?: string
  },
  budget: Budget
): Promise<void> {
  if (planBufferUpload(process.env).kind === 'unavailable') return

  const store = env.meriksirat_kv as KVNamespace
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

  const marker = await readMarker(store)
  const plan = planBufferAlert(bufferUsageLevel(usage), marker)
  if (plan.notify) {
    const result = await sendAdminsTelegramResult(
      db(env.meriksirat_d1),
      env.TELEGRAM_BOT_TOKEN,
      alertText(usage),
      budget
    )
    if (result !== 'sent') return
  }
  if (plan.marker === marker) return
  if (plan.marker) await store.put(MARKER_KEY, plan.marker)
  else await store.delete(MARKER_KEY)
}
