import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const clubCodeSchema = z.object({
  code: z.string().min(1, 'Enter the club code').max(64),
})

const updateOnboardingSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  birthday: z.string().min(1, 'Birthday is required'),
  wantsBirthdayCongratulation: z.boolean().optional(),
  instagramUsername: z.string().optional(),
  nuId: z.number().int().positive('NU ID must be a positive number'),
  major: z.string().min(1, 'Major is required'),
  graduationYear: z
    .number()
    .int()
    .min(2010)
    .max(3000, 'Graduation year must be between 2010 and 3000'),
})

export const submitClubCodeFn = createServerFn({ method: 'POST' })
  .validator(clubCodeSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { clubCodeMatches } = await import('@/lib/access/access-rules')
    const { getClubCode } = await import('@/lib/access/server')
    const { session, database } = await userContext()

    if (!clubCodeMatches(data.code, await getClubCode(database))) {
      return { success: false as const }
    }

    await database
      .update(user)
      .set({ isMember: true, updatedAt: new Date() })
      .where(eq(user.id, session.user.id))

    return { success: true as const }
  })

export const acceptSignupTermsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ accepted: z.literal(true) }))
  .handler(async () => {
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { signupKind } = await import('@/lib/auth/signup-domain')
    const { session, database } = await userContext()

    if (signupKind(session.user.email) === 'nu') {
      throw new Error('NU accounts finish signup by connecting Drive')
    }

    await database
      .update(user)
      .set({ termsAcceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, session.user.id))

    return { success: true as const }
  })

export const updateUserOnboardingFn = createServerFn({ method: 'POST' })
  .validator(updateOnboardingSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { session, database } = await userContext()

    const { loadAccessRules } = await import('@/lib/access/server')
    const rules = await loadAccessRules(database, session.user.id)
    if (!rules.canBook) {
      throw new Error('Club membership is required')
    }

    // Update user info but don't mark onboarding as complete yet
    await database
      .update(user)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        birthday: data.birthday,
        wantsBirthdayCongratulation: data.wantsBirthdayCongratulation ?? true,
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
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { session, database } = await userContext()

    const { loadAccessRules } = await import('@/lib/access/server')
    const rules = await loadAccessRules(database, session.user.id)
    if (!rules.canBook) {
      throw new Error('Club membership is required')
    }

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
      const { reconcileBirthdaysToCalendar } =
        await import('@/lib/birthdays/functions/birthdays')
      await reconcileBirthdaysToCalendar(database)
    } catch (syncError) {
      console.error('Failed to sync birthday to calendar:', syncError)
    }

    return { success: true }
  })
export const getTelegramLinkUrlFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { session, database } = await userContext()

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
    const { createTelegramLinkToken } =
      await import('@/lib/telegram/commands/start')
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
  const { userContext } = await import('@/lib/auth/context')
  const { session } = await userContext()

  // Import the telegram helper only on server side
  const { createTelegramLinkToken } =
    await import('@/lib/telegram/commands/start')
  const url = await createTelegramLinkToken(session.user.id)

  return {
    url,
  }
})

/**
 * Deletes an account that never finished signup. Called when the user
 * confirms leaving the signup page. Only accounts that are not members, have
 * not accepted the terms and have no flamekeeper record qualify.
 *
 * Sessions, accounts and telegram link tokens cascade via foreign keys; such
 * an account can never have bookings, so nothing else references it.
 */
export const deleteOnboardingAccountFn = createServerFn({ method: 'POST' })
  .validator(z.object({ confirm: z.literal(true) }))
  .handler(async () => {
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { session: sessionData, database } = await userContext()

    // Safety: an onboarded account must never be deleted through this path.
    const { flamekeeper } = await import('@/db/schema')
    const record = await database
      .select({
        isMember: user.isMember,
        termsAcceptedAt: user.termsAcceptedAt,
      })
      .from(user)
      .where(eq(user.id, sessionData.user.id))
      .limit(1)
      .then((rows) => rows[0])
    const fk = await database
      .select({ userId: flamekeeper.userId })
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, sessionData.user.id))
      .get()

    if (!record || record.isMember || record.termsAcceptedAt || fk) {
      throw new Error('Account has already finished signup')
    }

    await database.delete(user).where(eq(user.id, sessionData.user.id))

    return { success: true }
  })
