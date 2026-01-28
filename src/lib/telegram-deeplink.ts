import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { user, telegramTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFn } from '@/lib/session'
import { env } from 'cloudflare:workers'

export const getTelegramLinkUrl = createServerFn({ method: 'POST' })
  .handler(async () => {
    const session = await getSessionFn()
    if (!session?.user) throw new Error('Unauthorized')

    const userId = session.user.id
    const database = db(env.meriksirat_d1 as D1Database)

    // Already linked?
    const existing = await database
      .select({ chatId: user.telegramChatId })
      .from(user)
      .where(eq(user.id, userId))
      .get()

    if (existing?.chatId) {
      return { alreadyLinked: true }
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await database.insert(telegramTokens).values({
      token,
      userId,
      expiresAt,
      consumed: false,
    })

    const botUsername = env.TELEGRAM_BOT_USERNAME || 'your_bot_username'
    const telegramUrl = `https://t.me/${botUsername}?start=${token}`

    return { telegramUrl }
  })
