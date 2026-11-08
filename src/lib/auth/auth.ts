import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { planNewAccount } from '@/lib/auth/new-account'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@/db/schema'
import { user, session as sessionTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  database: drizzleAdapter(
    drizzle(env.meriksirat_d1 as D1Database, { schema }),
    {
      provider: 'sqlite',
    }
  ),
  user: {
    additionalFields: {
      termsAcceptedAt: { type: 'date', required: false, input: false },
    },
  },
  plugins: [tanstackStartCookies()],
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const { bufferEmails } = await import('@/lib/buffer/grant')
          const { isBufferEmail, BUFFER_ACCOUNT_MESSAGE } =
            await import('@/lib/buffer/grant-rules')
          if (isBufferEmail(newUser.email, await bufferEmails())) {
            throw new APIError('FORBIDDEN', { message: BUFFER_ACCOUNT_MESSAGE })
          }
          const plan = planNewAccount(newUser.email, new Date())
          if (!plan.ok) {
            throw new APIError('FORBIDDEN', { message: plan.error })
          }
          return { data: { termsAcceptedAt: plan.termsAcceptedAt } }
        },
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession
      if (!newSession) return
      const database = drizzle(env.meriksirat_d1 as D1Database, { schema })
      const row = await database
        .select({ status: user.status, bannedAt: user.bannedAt })
        .from(user)
        .where(eq(user.id, newSession.user.id))
        .get()
      if (row?.bannedAt) {
        await database
          .delete(sessionTable)
          .where(eq(sessionTable.userId, newSession.user.id))
        throw ctx.redirect('/login/?error=banned')
      }
      if (row?.status === 'Inactive') {
        await database
          .delete(sessionTable)
          .where(eq(sessionTable.userId, newSession.user.id))
        throw ctx.redirect('/login/?error=account_inactive')
      }
    }),
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
})
