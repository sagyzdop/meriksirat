import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { album, user } from '@/db/schema'
import { buildPublicNoticeText } from './public-notice'

const MAX_OWNERS_PER_RUN = 5

export async function runPublicAlbumNotices(env: {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
  BETTER_AUTH_URL?: string
}): Promise<void> {
  const database = db(env.meriksirat_d1)

  const pending = await database
    .select({
      id: album.id,
      title: album.title,
      ownerUserId: album.ownerUserId,
      chatId: user.telegramChatId,
    })
    .from(album)
    .innerJoin(user, eq(user.id, album.ownerUserId))
    .where(and(isNotNull(album.publicNoticePendingAt), isNull(album.deletedAt)))
    .orderBy(asc(album.publicNoticePendingAt), asc(album.id))
    .all()
  if (pending.length === 0) return

  const token = env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn(
      'TELEGRAM_BOT_TOKEN not configured, leaving public album notices pending'
    )
    return
  }

  const byOwner = new Map<string, typeof pending>()
  for (const row of pending) {
    const list = byOwner.get(row.ownerUserId) ?? []
    list.push(row)
    byOwner.set(row.ownerUserId, list)
  }

  const { TelegramAPI } = await import('@/lib/telegram/api')
  const telegram = new TelegramAPI(token)
  const origin = env.BETTER_AUTH_URL ?? ''

  let sent = 0
  for (const rows of byOwner.values()) {
    const chatId = rows[0].chatId
    if (chatId) {
      if (sent >= MAX_OWNERS_PER_RUN) break
      sent++
      try {
        await telegram.sendMessage(chatId, buildPublicNoticeText(rows, origin))
      } catch (error) {
        console.error(
          `Failed to send public album notice to ${rows[0].ownerUserId}:`,
          error
        )
        continue
      }
    }
    await database
      .update(album)
      .set({ publicNoticePendingAt: null })
      .where(
        inArray(
          album.id,
          rows.map((r) => r.id)
        )
      )
  }
}
