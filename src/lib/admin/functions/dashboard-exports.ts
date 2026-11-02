import { createServerFn } from '@tanstack/react-start'
import { siteOrigin } from '@/lib/format'
import { BroadcastMessageSchema } from '../dashboard-types'
import type { AdminAlbumExport, BroadcastResult } from '../dashboard-types'

export const exportAlbumsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminAlbumExport[]> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { album, albumMember, user } = await import('@/db/schema')
    const { eq, isNull } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const origin = siteOrigin(env.BETTER_AUTH_URL)

    // D1 caps bound parameters at 100/query, so this export avoids inArray:
    // the owner comes from a join and the member query is intentionally
    // unfiltered (its rows are keyed by album id and only exported albums
    // are ever looked up).
    const rows = await database
      .select({
        id: album.id,
        title: album.title,
        event: album.event,
        eventDate: album.eventDate,
        createdAt: album.createdAt,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerTelegramUsername: user.telegramUsername,
      })
      .from(album)
      .leftJoin(user, eq(album.ownerUserId, user.id))
      .where(isNull(album.deletedAt))
      .orderBy(album.createdAt)
      .all()

    const memberRows = await database
      .select({
        albumId: albumMember.albumId,
        name: user.name,
        email: user.email,
        telegramUsername: user.telegramUsername,
      })
      .from(albumMember)
      .innerJoin(user, eq(albumMember.userId, user.id))
      .all()

    const membersByAlbum = new Map<
      string,
      {
        name: string
        email: string | null
        telegramUsername: string | null
      }[]
    >()
    for (const m of memberRows) {
      const list = membersByAlbum.get(m.albumId) ?? []
      list.push({
        name: m.name,
        email: m.email,
        telegramUsername: m.telegramUsername,
      })
      membersByAlbum.set(m.albumId, list)
    }

    return rows.map((row) => {
      const owner =
        row.ownerName !== null
          ? {
              name: row.ownerName,
              email: row.ownerEmail,
              telegramUsername: row.ownerTelegramUsername,
            }
          : null
      const members = membersByAlbum.get(row.id) ?? []
      const authors = [...(owner ? [owner] : []), ...members]
      return {
        id: row.id,
        title: row.title,
        event: row.event,
        eventDate: row.eventDate,
        createdAt: row.createdAt,
        albumUrl: `${origin}/albums/${row.id}`,
        authors,
      }
    })
  }
)

export const broadcastTelegramMessageFn = createServerFn({ method: 'POST' })
  .validator(BroadcastMessageSchema)
  .handler(async ({ data }): Promise<BroadcastResult> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { user } = await import('@/db/schema')
    const { desc } = await import('drizzle-orm')
    const { TelegramAPI } = await import('@/lib/telegram/api')
    const { formatUserDisplayName } = await import('@/lib/utils')

    // Broadcasts reach every user with a linked chat, so only admins may send.
    const { database } = await adminContext(['admin'])

    const allUsers = await database
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
        telegramChatId: user.telegramChatId,
      })
      .from(user)
      .orderBy(desc(user.createdAt), desc(user.id))
      .all()

    const total = allUsers.length
    const linked = allUsers.filter((row) => row.telegramChatId?.trim())
    const skipped = total - linked.length

    if (linked.length === 0) {
      return {
        total,
        linked: 0,
        sent: 0,
        failed: 0,
        skipped,
        offset: 0,
        done: true,
      }
    }

    // One chunk per invocation. A broadcast is usually larger than a single
    // Worker invocation can deliver (Telegram rate limits + the per-request
    // subrequest budget), so the caller drives `offset` chunk by chunk and
    // this function stays small and fast.
    const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

    const chunk = linked.slice(data.offset, data.offset + data.limit)
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        const displayName = formatUserDisplayName({
          firstName: row.firstName,
          lastName: row.lastName,
          name: row.name,
          telegramUsername: row.telegramUsername,
        })
        await telegram.sendMessage(
          row.telegramChatId!,
          `${data.message}\n\n— ${displayName}`,
          { disable_web_page_preview: true }
        )
      })
    )

    let sent = 0
    let failed = 0
    for (const result of results) {
      if (result.status === 'fulfilled') sent += 1
      else failed += 1
    }

    const processed = data.offset + sent + failed
    const done = processed >= linked.length

    // Log a summary to the club channel once the whole broadcast finishes.
    if (done) {
      try {
        const channel = env.TELEGRAM_CLUB_CHANNEL_ID
        if (channel) {
          await telegram.sendMessage(
            channel,
            `Broadcast sent to ${processed - failed} user(s)${failed ? `, ${failed} failed` : ''}.`,
            { disable_web_page_preview: true }
          )
        }
      } catch (error) {
        console.warn('Failed to log broadcast to the club channel:', error)
      }
    }

    return {
      total,
      linked: linked.length,
      sent,
      failed,
      skipped,
      offset: data.offset,
      done,
    }
  })
