import { and, eq, inArray, isNull } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import type { Database } from '@/db'
import { album, favorite, photo, user } from '@/db/schema'
import { sendEmail } from '@/lib/google/email'
import {
  canExpireEarly,
  earlyExpiryDate,
  planEarlyExpiryNotices,
  suggestDeletions,
} from '@/lib/pool/suggestions'
import type { NoticeUser } from '@/lib/pool/suggestions'
import { formatLongDate } from '@/lib/club-time'
import { siteOrigin } from '@/lib/format'

export interface DeletionSuggestion {
  id: string
  title: string
  expiresAt: Date | null
  photoBytes: number
  photoCount: number
  favoriteCount: number
}

export async function listDeletionSuggestions(
  database: Database
): Promise<DeletionSuggestion[]> {
  const rows = await database
    .select({
      id: album.id,
      title: album.title,
      expiresAt: album.expiresAt,
      pinned: album.pinned,
      deletedAt: album.deletedAt,
      photoBytes: album.photoBytes,
      photoCount: album.photoCount,
      favoriteCount: album.favoriteCount,
    })
    .from(album)
    .where(and(isNull(album.deletedAt), eq(album.pinned, false)))
    .all()
  return suggestDeletions(rows).map(
    ({ pinned: _pinned, deletedAt: _deletedAt, ...rest }) => rest
  )
}

export async function expireAlbumEarly(
  database: Database,
  albumId: string
): Promise<{ expiresAt: Date; notified: number }> {
  const row = await database
    .select({
      id: album.id,
      title: album.title,
      ownerUserId: album.ownerUserId,
      expiresAt: album.expiresAt,
      pinned: album.pinned,
      deletedAt: album.deletedAt,
    })
    .from(album)
    .where(eq(album.id, albumId))
    .get()
  if (!row) throw new Error('Album not found')

  const now = new Date()
  if (!canExpireEarly(row, now)) {
    throw new Error('This album cannot be expired earlier')
  }
  const expiresAt = earlyExpiryDate(now)

  await database
    .update(album)
    .set({
      expiresAt,
      expiryReminder30SentAt: null,
      expiryReminder7SentAt: now,
      updatedAt: now,
    })
    .where(eq(album.id, albumId))

  const favoriters = await database
    .selectDistinct({
      id: user.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
    })
    .from(favorite)
    .innerJoin(photo, eq(photo.id, favorite.photoId))
    .innerJoin(user, eq(user.id, favorite.userId))
    .where(and(eq(photo.albumId, albumId), eq(photo.state, 'live')))
    .all()
  const owner = await database
    .select({
      id: user.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
    })
    .from(user)
    .where(inArray(user.id, [row.ownerUserId]))
    .all()
  const users: NoticeUser[] = [...owner, ...favoriters]
  const recipients = planEarlyExpiryNotices(row.ownerUserId, users)

  const origin = siteOrigin(env.BETTER_AUTH_URL)
  const link = origin ? `\n${origin}/albums/${albumId}` : ''
  const when = formatLongDate(expiresAt)
  const botToken = env.TELEGRAM_BOT_TOKEN
  const telegram = botToken
    ? new (await import('@/lib/telegram/api')).TelegramAPI(botToken)
    : null

  let notified = 0
  for (const r of recipients) {
    const text =
      r.role === 'owner'
        ? `Your album "${row.title}" will be deleted on ${when} to free up storage. There is no backup, so download the photos you want to keep.${link}`
        : `An album with photos you favorited, "${row.title}", will be deleted on ${when} to free up storage. There is no backup, so download the photos you want to keep.${link}`
    let sent = false
    if (r.channel === 'telegram' && telegram && r.telegramChatId) {
      try {
        await telegram.sendMessage(r.telegramChatId, text)
        sent = true
      } catch (error) {
        console.error(`Early expiry Telegram notice failed for ${r.id}:`, error)
      }
    }
    if (!sent) {
      sent = await sendEmail({
        to: r.email,
        subject: `Album "${row.title}" will be deleted on ${when}`,
        text,
      })
    }
    if (sent) notified++
  }

  return { expiresAt, notified }
}
