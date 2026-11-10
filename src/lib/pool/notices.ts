import { eq, inArray } from 'drizzle-orm'
import type { Database } from '@/db'
import { favorite, user } from '@/db/schema'
import { siteOrigin } from '@/lib/format'
import { formatLongDate } from '@/lib/club-time'
import {
  deletionNoticeText,
  deletionRecipients,
} from '@/lib/albums/storage-plan'
import {
  tombstoneNoticeText,
  type FlamekeeperTombstoneReason,
} from '@/lib/albums/tombstone'

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

export async function notifyAlbumScheduledDeletion(
  database: Database,
  env: NoticeEnv,
  album: { id: string; title: string; ownerUserId: string },
  deletionAt: Date
): Promise<number> {
  try {
    if (!env.TELEGRAM_BOT_TOKEN) return 0
    const favoriters = await database
      .selectDistinct({ userId: favorite.userId })
      .from(favorite)
      .where(eq(favorite.albumId, album.id))
      .all()
    const recipients = deletionRecipients(
      album.ownerUserId,
      favoriters.map((f) => f.userId)
    )
    const chats = await database
      .select({ chatId: user.telegramChatId })
      .from(user)
      .where(inArray(user.id, recipients.slice(0, 90)))
      .all()
    const origin = siteOrigin(
      env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL
    )
    const text = deletionNoticeText(
      album.title,
      formatLongDate(deletionAt),
      origin ? `${origin}/albums/${album.id}` : undefined
    )
    const { TelegramAPI } = await import('@/lib/telegram/api')
    const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)
    let sent = 0
    for (const { chatId } of chats) {
      if (!chatId?.trim()) continue
      try {
        await telegram.sendMessage(chatId.trim(), text)
        sent++
      } catch (error) {
        console.error(`Failed to notify about album ${album.id}:`, error)
      }
    }
    return sent
  } catch (error) {
    console.error(`Failed to notify about album ${album.id}:`, error)
    return 0
  }
}

const MAX_DELETION_EMAILS = 50

export async function emailAlbumScheduledDeletion(
  database: Database,
  env: NoticeEnv,
  album: { id: string; title: string },
  deletionAt: Date
): Promise<number> {
  try {
    const rows = await database
      .selectDistinct({ email: user.email, name: user.name })
      .from(favorite)
      .innerJoin(user, eq(user.id, favorite.userId))
      .where(eq(favorite.albumId, album.id))
      .limit(MAX_DELETION_EMAILS)
      .all()
    if (rows.length === 0) return 0
    const origin = siteOrigin(
      env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL
    )
    const { sendEmail } = await import('@/lib/google/email')
    let sent = 0
    for (const row of rows) {
      const body = deletionNoticeText(
        album.title,
        formatLongDate(deletionAt),
        origin ? `${origin}/albums/${album.id}` : undefined
      )
      const ok = await sendEmail({
        to: row.email,
        subject: `The album "${album.title}" is scheduled for deletion`,
        text: `Hi ${row.name},\n\nYou favorited photos in this album. ${body}\n\nMerikSirat`,
      })
      if (ok) sent++
    }
    return sent
  } catch (error) {
    console.error(`Failed to email about album ${album.id}:`, error)
    return 0
  }
}
