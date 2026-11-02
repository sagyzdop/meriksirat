import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import { user } from '@/db/schema'
import { siteOrigin } from '@/lib/format'
import { tombstoneNoticeText, type FlamekeeperTombstoneReason } from './expiry'

export interface NoticeEnv {
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}

export async function ownerTelegramChat(
  database: Database,
  ownerUserId: string
): Promise<string | null> {
  const row = await database
    .select({ chatId: user.telegramChatId })
    .from(user)
    .where(eq(user.id, ownerUserId))
    .get()
  return row?.chatId?.trim() || null
}

export async function notifyAlbumTombstoned(
  database: Database,
  env: NoticeEnv,
  album: { id: string; title: string; ownerUserId: string },
  reason: FlamekeeperTombstoneReason
): Promise<boolean> {
  try {
    if (!env.TELEGRAM_BOT_TOKEN) return false
    const chatId = await ownerTelegramChat(database, album.ownerUserId)
    if (!chatId) return false
    const origin = siteOrigin(
      env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL
    )
    const { TelegramAPI } = await import('@/lib/telegram/api')
    await new TelegramAPI(env.TELEGRAM_BOT_TOKEN).sendMessage(
      chatId,
      tombstoneNoticeText(
        reason,
        album.title,
        origin ? `${origin}/albums/${album.id}` : undefined
      )
    )
    return true
  } catch (error) {
    console.error(`Failed to notify owner of album ${album.id}:`, error)
    return false
  }
}
