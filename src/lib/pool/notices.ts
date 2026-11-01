import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'
import { tombstoneNoticeText, type FlamekeeperTombstoneReason } from './expiry'

type Database = ReturnType<typeof db>

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

/**
 * Tell an album's owner their album was tombstoned because its flamekeeper
 * was lost or left. One request; owners without a Telegram chat are skipped.
 * Never throws.
 */
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
    const origin = (env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? '')
      .trim()
      .replace(/\/+$/, '')
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
