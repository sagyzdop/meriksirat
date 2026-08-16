import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

const updateOnboardingSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  birthday: z.string().min(1, 'Birthday is required'),
  instagramUsername: z.string().optional(),
  nuId: z.number().int().positive('NU ID must be a positive number'),
  major: z.string().min(1, 'Major is required'),
  graduationYear: z
    .number()
    .int()
    .min(2010)
    .max(3000, 'Graduation year must be between 2010 and 3000'),
})

export const updateUserOnboardingFn = createServerFn({ method: 'POST' })
  .validator(updateOnboardingSchema)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
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
        instagramUsername: data.instagramUsername,
        nuId: data.nuId,
        major: data.major,
        graduationYear: data.graduationYear,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))

    return { success: true, needsTelegramLink: true }
  })

export const completeTelegramOnboardingFn = createServerFn({ method: 'POST' })
  .validator(z.object({ skipTelegram: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    if (!data.skipTelegram) {
      const userData = await database
        .select({ telegramChatId: user.telegramChatId })
        .from(user)
        .where(eq(user.id, session.user.id))
        .get()

      if (!userData?.telegramChatId) {
        throw new Error('Telegram not linked')
      }
    }

    await database
      .update(user)
      .set({
        onboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))

    try {
      const { reconcileBirthdaysToCalendar } = await import(
        '@/lib/birthdays/functions/birthdays'
      )
      await reconcileBirthdaysToCalendar(database)
    } catch (syncError) {
      console.error('Failed to sync birthday to calendar:', syncError)
    }

    return { success: true }
  })
export const getTelegramLinkUrlFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders()
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const isDevelopment = process.env.DEV === 'true'

    // Check if user already has telegram linked
    const userData = await database
      .select({ telegramChatId: user.telegramChatId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    if (userData?.telegramChatId) {
      return {
        alreadyLinked: true,
        url: null,
        isDevelopment,
      }
    }

    if (isDevelopment) {
      return { alreadyLinked: false, url: null, isDevelopment: true }
    }

    // Import the telegram helper only on server side
    const { createTelegramLinkToken } = await import(
      '@/lib/telegram/commands/start'
    )
    const url = await createTelegramLinkToken(session.user.id)

    return {
      alreadyLinked: false,
      url,
      isDevelopment,
    }
  }
)

export const getTelegramUpdateLinkUrlFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const headers = getRequestHeaders()
  const { auth } = await import('@/lib/auth/auth')
  const session = await auth.api.getSession({
    headers,
  })

  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  // Import the telegram helper only on server side
  const { createTelegramLinkToken } = await import(
    '@/lib/telegram/commands/start'
  )
  const url = await createTelegramLinkToken(session.user.id)

  return {
    url,
  }
})
