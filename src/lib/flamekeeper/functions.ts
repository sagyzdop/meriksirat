import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import {
  AdminFlamekeepersSchema,
  ConfirmGraduationSchema,
  StartDriveConnectSchema,
  UpdateFlamekeeperSchema,
  type AdminFlamekeeperRow,
  type MyFlamekeeper,
  type StopStatus,
} from './types'

export const getMyFlamekeeperFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MyFlamekeeper | null> => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { flamekeeper, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const row = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()

    if (!row) return null
    const owner = await database
      .select({ graduationDate: user.graduationDate })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()
    const { graduationConfirmDue } = await import('@/lib/pool/graduation')
    return {
      state: row.state,
      pledgedBytes: row.pledgedBytes,
      usedBytes: row.usedBytes,
      graduationDate: owner?.graduationDate ?? null,
      graduationConfirmDue: graduationConfirmDue(row, new Date()),
      lostSince: row.lostSince,
    }
  }
)

export const startDriveConnectFn = createServerFn({ method: 'POST' })
  .validator(StartDriveConnectSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { flamekeeper, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { loadAccessRules } = await import('@/lib/access/server')
    const {
      buildDriveAuthUrl,
      flamekeeperCallbackUrl,
      gbToBytes,
      isValidGraduationDate,
      isValidPledgeGb,
    } = await import('./rules')

    const { isMasterEmail, MASTER_FLAMEKEEPER_MESSAGE } =
      await import('./master')
    if (isMasterEmail(session.user.email, process.env.GOOGLE_MASTER_EMAIL)) {
      throw new Error(MASTER_FLAMEKEEPER_MESSAGE)
    }
    const { bufferEmails } = await import('@/lib/buffer/grant')
    const { isBufferEmail, BUFFER_ACCOUNT_MESSAGE } =
      await import('@/lib/buffer/grant-rules')
    if (isBufferEmail(session.user.email, await bufferEmails(database))) {
      throw new Error(BUFFER_ACCOUNT_MESSAGE)
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')

    let pending: {
      userId: string
      pledgedBytes: number
      graduationDate: string | null
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
      const owner = await database
        .select({ graduationDate: user.graduationDate })
        .from(user)
        .where(eq(user.id, session.user.id))
        .get()
      pending = {
        userId: session.user.id,
        pledgedBytes: existing.pledgedBytes,
        graduationDate: owner?.graduationDate ?? null,
        termsAcceptedAt: existing.termsAcceptedAt.getTime(),
      }
    }

    const { saveOAuthState } = await import('@/lib/oauth-state')
    const nonce = await saveOAuthState(database, 'flamekeeper', pending)

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
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { gbToBytes, isValidPledgeGb } = await import('./rules')

    if (!isValidPledgeGb(data.pledgeGb)) throw new Error('Invalid pledge')

    const existing = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()
    if (!existing) throw new Error('You are not a flamekeeper')
    if (existing.state === 'drained') {
      throw new Error('Sign up again to resume flamekeeping')
    }

    const { graduationDateError } = await import('@/lib/graduation-date')
    const { user } = await import('@/db/schema')
    const owner = await database
      .select({ graduationDate: user.graduationDate })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()
    const dateError = graduationDateError(data.graduationDate, {
      isFlamekeeper: true,
      current: owner?.graduationDate,
    })
    if (dateError) throw new Error(dateError)

    const { changePledge } = await import('@/lib/pool/stop-server')
    await changePledge(database, session.user.id, {
      pledgedBytes: gbToBytes(data.pledgeGb),
      graduationDate: data.graduationDate,
    })

    return { success: true }
  })

export const confirmGraduationFn = createServerFn({ method: 'POST' })
  .validator(ConfirmGraduationSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { flamekeeper, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const existing = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()
    if (!existing) throw new Error('You are not a flamekeeper')
    const owner = await database
      .select({ graduationDate: user.graduationDate })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    const date = data.graduationDate ?? owner?.graduationDate
    if (!date) throw new Error('Enter your expected graduation month')
    const { saveGraduationDate } = await import('@/lib/pool/stop-server')
    await saveGraduationDate(database, session.user.id, date)
    return { success: true }
  })

export const getAdminFlamekeepersFn = createServerFn({ method: 'GET' })
  .validator(AdminFlamekeepersSchema)
  .handler(async ({ data }): Promise<AdminFlamekeeperRow[]> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { userSearch } = await import('@/lib/user/search')
    const { database } = await adminContext(['admin', 'manager'])

    const { flamekeeper, user } = await import('@/db/schema')
    const { eq, desc } = await import('drizzle-orm')
    const { loadSettings } = await import('@/lib/booking/load-settings')
    const { DAY_MS, lostDeadline } = await import('@/lib/pool/health')
    const graceMs = (await loadSettings(database)).lostGraceDays * DAY_MS

    const rows = await database
      .select({
        userId: flamekeeper.userId,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        image: user.image,
        isMember: user.isMember,
        status: user.status,
        state: flamekeeper.state,
        pledgedBytes: flamekeeper.pledgedBytes,
        usedBytes: flamekeeper.usedBytes,
        driveUsageBytes: flamekeeper.driveUsageBytes,
        graduationDate: user.graduationDate,
        graduationConfirmedAt: flamekeeper.graduationConfirmedAt,
        healthCheckedAt: flamekeeper.healthCheckedAt,
        lostSince: flamekeeper.lostSince,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
        createdAt: flamekeeper.createdAt,
      })
      .from(flamekeeper)
      .innerJoin(user, eq(user.id, flamekeeper.userId))
      .where(data.search ? userSearch(data.search) : undefined)
      .orderBy(desc(flamekeeper.createdAt))
      .limit(500)

    return rows.map((row) => ({
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.name,
      email: row.email,
      image: row.image,
      isMember: row.isMember,
      status: row.status,
      state: row.state,
      pledgedBytes: row.pledgedBytes,
      usedBytes: row.usedBytes,
      driveUsageBytes: row.driveUsageBytes,
      graduationDate: row.graduationDate,
      graduationConfirmedAt: row.graduationConfirmedAt,
      healthCheckedAt: row.healthCheckedAt,
      lostSince: row.lostSince,
      lostDeadline: row.lostSince ? lostDeadline(row.lostSince, graceMs) : null,
      bannedAt: row.bannedAt,
      banReason: row.banReason,
      createdAt: row.createdAt,
    }))
  })

export const optOutFlamekeeperFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<StopStatus> => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { optOutFlamekeeper } = await import('@/lib/pool/stop-server')
    return optOutFlamekeeper(database, session.user.id)
  }
)

export const deleteMyAccountFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { loadAccessRules } = await import('@/lib/access/server')

    const rules = await loadAccessRules(database, session.user.id)
    if (!rules.canDeleteAccount) {
      throw new Error(
        'Club members keep their account. Other accounts can be deleted once any flamekeeping has stopped.'
      )
    }
    await database.delete(user).where(eq(user.id, session.user.id))
    return { success: true }
  }
)
