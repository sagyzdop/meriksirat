import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { z } from 'zod'

const updateOnboardingSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  birthday: z.string().min(1, 'Birthday is required'),
})

export const getUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const userData = await database
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    return userData
  }
)

export const updateUserOnboardingFn = createServerFn({ method: 'POST' })
  .inputValidator(updateOnboardingSchema)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const database = db(env.meriksirat_d1 as D1Database)
    
    // Update user info but don't mark onboarding as complete yet
    await database
      .update(user)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        birthday: data.birthday,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))

    return { success: true, needsTelegramLink: true }
  })
  
export const completeTelegramOnboardingFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ skipTelegram: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const database = db(env.meriksirat_d1 as D1Database)
    
    if (!data.skipTelegram) {
      // Check if user has telegram linked
      const userData = await database
        .select({ telegramChatId: user.telegramChatId })
        .from(user)
        .where(eq(user.id, session.user.id))
        .get()

      if (!userData?.telegramChatId) {
        throw new Error('Telegram not linked')
      }
    }

    // Mark onboarding as complete
    await database
      .update(user)
      .set({
        onboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))

    return { success: true }
  })