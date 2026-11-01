import { createServerFn } from '@tanstack/react-start'
import { getRequest, getRequestHeaders } from '@tanstack/react-start/server'
import {
  AdminFlamekeepersSchema,
  StartDriveConnectSchema,
  UpdateFlamekeeperSchema,
  type AdminFlamekeeperRow,
  type MyFlamekeeper,
} from './types'

export const getMyFlamekeeperFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MyFlamekeeper | null> => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const session = await resolveSession(getRequestHeaders())
    if (!session?.user) throw new Error('Unauthorized')

    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const database = db(env.meriksirat_d1 as D1Database)
    const row = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()

    if (!row) return null
    return {
      state: row.state,
      pledgedBytes: row.pledgedBytes,
      usedBytes: row.usedBytes,
      graduationDate: row.graduationDate,
      drainingDeadline: row.drainingDeadline,
      lostSince: row.lostSince,
      albumsHosted: 0,
    }
  }
)

export const startDriveConnectFn = createServerFn({ method: 'POST' })
  .validator(StartDriveConnectSchema)
  .handler(async ({ data }) => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const session = await resolveSession(getRequestHeaders())
    if (!session?.user) throw new Error('Unauthorized')

    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { loadAccessRules } = await import('@/lib/access/server')
    const {
      buildDriveAuthUrl,
      flamekeeperCallbackUrl,
      gbToBytes,
      isValidGraduationDate,
      isValidPledgeGb,
    } = await import('./rules')

    const database = db(env.meriksirat_d1 as D1Database)
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')

    let pending: {
      userId: string
      pledgedBytes: number
      graduationDate: string
      termsAcceptedAt: number
    }

    if (data.mode === 'signup') {
      const rules = await loadAccessRules(database, session.user.id)
      if (!rules.canBecomeFlamekeeper) {
        throw new Error(
          'Only @nu.edu.kz accounts that are not already flamekeepers can sign up.'
        )
      }
      if (!isValidPledgeGb(data.pledgeGb)) throw new Error('Invalid pledge')
      if (!isValidGraduationDate(data.graduationDate)) {
        throw new Error('Expected graduation date must be in the future')
      }
      pending = {
        userId: session.user.id,
        pledgedBytes: gbToBytes(data.pledgeGb),
        graduationDate: data.graduationDate,
        termsAcceptedAt: Date.now(),
      }
    } else {
      const existing = await database
        .select()
        .from(flamekeeper)
        .where(eq(flamekeeper.userId, session.user.id))
        .get()
      if (!existing || existing.state !== 'lost') {
        throw new Error('Only a lost flamekeeper can reconnect Drive')
      }
      pending = {
        userId: session.user.id,
        pledgedBytes: existing.pledgedBytes,
        graduationDate: existing.graduationDate,
        termsAcceptedAt: existing.termsAcceptedAt.getTime(),
      }
    }

    const nonce = crypto.randomUUID()
    await env.meriksirat_kv.put(
      `flamekeeper-oauth:${nonce}`,
      JSON.stringify(pending),
      { expirationTtl: 600 }
    )

    const origin = new URL(getRequest().url).origin
    return {
      url: buildDriveAuthUrl({
        clientId,
        redirectUri: flamekeeperCallbackUrl(origin),
        state: nonce,
        loginHint: session.user.email,
      }),
    }
  })

export const updateFlamekeeperFn = createServerFn({ method: 'POST' })
  .validator(UpdateFlamekeeperSchema)
  .handler(async ({ data }) => {
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const session = await resolveSession(getRequestHeaders())
    if (!session?.user) throw new Error('Unauthorized')

    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const {
      DRAIN_GRACE_MS,
      gbToBytes,
      isValidGraduationDate,
      isValidPledgeGb,
      pledgeLowerThanUsed,
    } = await import('./rules')

    if (!isValidPledgeGb(data.pledgeGb)) throw new Error('Invalid pledge')

    const database = db(env.meriksirat_d1 as D1Database)
    const existing = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()
    if (!existing) throw new Error('You are not a flamekeeper')
    if (existing.state === 'drained') {
      throw new Error('Sign up again to resume flamekeeping')
    }

    if (
      data.graduationDate !== existing.graduationDate &&
      !isValidGraduationDate(data.graduationDate)
    ) {
      throw new Error('Expected graduation date must be in the future')
    }

    const pledgedBytes = gbToBytes(data.pledgeGb)
    const set: Partial<typeof flamekeeper.$inferInsert> = {
      pledgedBytes,
      graduationDate: data.graduationDate,
      updatedAt: new Date(),
    }

    if (pledgeLowerThanUsed(pledgedBytes, existing.usedBytes)) {
      if (existing.state === 'active' || existing.state === 'full') {
        set.state = 'draining'
        set.drainingDeadline = new Date(Date.now() + DRAIN_GRACE_MS)
      }
    } else if (existing.state === 'full' && pledgedBytes > existing.usedBytes) {
      set.state = 'active'
    }

    await database
      .update(flamekeeper)
      .set(set)
      .where(eq(flamekeeper.userId, session.user.id))

    return { success: true }
  })

export const getAdminFlamekeepersFn = createServerFn({ method: 'GET' })
  .validator(AdminFlamekeepersSchema)
  .handler(async ({ data }): Promise<AdminFlamekeeperRow[]> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    await checkAdminPermission(getRequestHeaders(), ['admin', 'manager'])

    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { flamekeeper, user } = await import('@/db/schema')
    const { eq, like, or, desc } = await import('drizzle-orm')

    const database = db(env.meriksirat_d1 as D1Database)
    const term = data.search ? `%${data.search}%` : null

    const rows = await database
      .select({
        userId: flamekeeper.userId,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        image: user.image,
        isMember: user.isMember,
        state: flamekeeper.state,
        pledgedBytes: flamekeeper.pledgedBytes,
        usedBytes: flamekeeper.usedBytes,
        graduationDate: flamekeeper.graduationDate,
        createdAt: flamekeeper.createdAt,
      })
      .from(flamekeeper)
      .innerJoin(user, eq(user.id, flamekeeper.userId))
      .where(
        term
          ? or(
              like(user.name, term),
              like(user.email, term),
              like(user.firstName, term),
              like(user.lastName, term)
            )
          : undefined
      )
      .orderBy(desc(flamekeeper.createdAt))
      .limit(500)

    return rows.map((row) => ({
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.name,
      email: row.email,
      image: row.image,
      isMember: row.isMember,
      state: row.state,
      pledgedBytes: row.pledgedBytes,
      usedBytes: row.usedBytes,
      graduationDate: row.graduationDate,
      createdAt: row.createdAt,
    }))
  })
