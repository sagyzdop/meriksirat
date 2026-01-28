import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/db'
import { user, telegramTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/api/telegram')({
  server: {
    handlers: {
      async POST({ request }) {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET
        const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')

        if (secret && headerSecret !== secret) {
          return new Response('Unauthorized', { status: 401 })
        }

        const update = await request.json() as { message?: { text?: string; chat: { id: number | string }; from?: { username?: string } } }
        const msg = update.message
        if (!msg?.text) return new Response('ok')

        const match = msg.text.match(/^\/start (.+)$/)
        if (!match) return new Response('ok')

        const token = match[1]
        const chatId = String(msg.chat.id)
        const username = msg.from?.username ?? null

        const database = db(env.meriksirat_d1 as D1Database)

        const tokenRow = await database
          .select()
          .from(telegramTokens)
          .where(eq(telegramTokens.token, token))
          .get()

        if (!tokenRow || tokenRow.consumed || tokenRow.expiresAt < new Date()) {
          await sendMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, 'Link expired or invalid.')
          return new Response('ok')
        }

        // Link user and complete onboarding
        await database
          .update(user)
          .set({
            telegramChatId: chatId,
            telegramUsername: username,
            onboardingComplete: true,
            updatedAt: new Date(),
          })
          .where(eq(user.id, tokenRow.userId))

        // Consume token
        await database
          .update(telegramTokens)
          .set({ consumed: true })
          .where(eq(telegramTokens.token, token))

        await sendMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, 'Telegram linked ✅')
        return new Response('ok')
      },
    },
  },
})

async function sendMessage(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}
