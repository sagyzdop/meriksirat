import { betterAuth } from 'better-auth'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@/db/schema'
import { user } from '@/db/schema'
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
  plugins: [tanstackStartCookies()],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession
      if (!newSession) return
      const database = drizzle(env.meriksirat_d1 as D1Database, { schema })
      const row = await database
        .select({ status: user.status })
        .from(user)
        .where(eq(user.id, newSession.user.id))
        .get()
      if (row?.status === 'Inactive') {
        throw new APIError('FORBIDDEN', {
          message: 'Account is inactive',
        })
      }
    }),
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
})
