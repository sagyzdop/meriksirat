import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { flamekeeper, settings, user } from '@/db/schema'
import { type Budget } from '@/lib/cron/budget'
import {
  DEFAULT_FLAMEKEEPER_CAP_BYTES,
  DEFAULT_POOL_LOW_ALERT_PERCENT,
  poolAlert,
  poolStats,
  type PoolFlamekeeper,
} from './placement'

export async function loadCapBytes(database: Database): Promise<number> {
  const row = await database
    .select({ cap: settings.flamekeeperCapBytes })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()
  return row?.cap ?? DEFAULT_FLAMEKEEPER_CAP_BYTES
}

export async function loadPoolLowAlertPercent(
  database: Database
): Promise<number> {
  const row = await database
    .select({ percent: settings.poolLowAlertPercent })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()
  return row?.percent ?? DEFAULT_POOL_LOW_ALERT_PERCENT
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
      .select({
        alertedAt: settings.poolLowAlertedAt,
        alertPercent: settings.poolLowAlertPercent,
      })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get(),
  ])

  if (!settingsRow) return
  const stats = poolStats(fks, cap)
  const alert = poolAlert(
    stats,
    settingsRow.alertedAt,
    settingsRow.alertPercent
  )
  if (alert === 'alert') {
    const { formatGb } = await import('@/lib/flamekeeper/rules')
    const result = await sendAdminsTelegramResult(
      database,
      env.TELEGRAM_BOT_TOKEN,
      `#savenuimg pool is low: ${formatGb(stats.usedBytes)} used and ${formatGb(stats.freeBytes)} free of ${formatGb(stats.pledgedBytes)} pledged across ${stats.flamekeepers} flamekeepers. Recruit flamekeepers or schedule albums for deletion.`,
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
