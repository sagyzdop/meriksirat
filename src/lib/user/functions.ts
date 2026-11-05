import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { UpdateUserProfileSchema, type UserProfile } from './types'

export const getUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<UserProfile | null> => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')

    const headers = getRequestHeaders()
    const session = await resolveSession(headers)

    if (!session?.user) {
      return null
    }

    const { isMasterEmail } = await import('@/lib/flamekeeper/master')
    const isMaster = isMasterEmail(
      session.user.email,
      process.env.GOOGLE_MASTER_EMAIL
    )

    const { db } = await import('@/db')
    const { user, flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { env } = await import('cloudflare:workers')

    const database = db(env.meriksirat_d1 as D1Database)
    const freshUser = await database
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    if (!freshUser) return { ...session.user, isMaster } as UserProfile

    const fk = await database
      .select({ state: flamekeeper.state })
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, freshUser.id))
      .get()
    return {
      ...freshUser,
      flamekeeperState: fk?.state ?? null,
      isMaster,
    } as UserProfile
  }
)

export const updateUserProfileFn = createServerFn({ method: 'POST' })
  .validator(UpdateUserProfileSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { session, database } = await userContext()

    if (Object.values(data).every((value) => value === undefined)) {
      throw new Error('No valid fields provided for update')
    }

    const { graduationDate, ...fields } = data
    if (graduationDate !== undefined) {
      const { saveGraduationDate } = await import('@/lib/pool/stop-server')
      await saveGraduationDate(database, session.user.id, graduationDate)
    }
    if (Object.values(fields).some((value) => value !== undefined)) {
      await database
        .update(user)
        .set(fields)
        .where(eq(user.id, session.user.id))
    }

    if (data.birthday !== undefined) {
      try {
        const { reconcileBirthdaysToCalendar } =
          await import('@/lib/birthdays/functions/birthdays')
        await reconcileBirthdaysToCalendar(database)
      } catch (syncError) {
        console.error('Failed to sync birthday to calendar:', syncError)
      }
    }

    const updatedUser = await database
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    return updatedUser
  })
