import { createServerFn } from '@tanstack/react-start'
import { getRequest, getRequestHeaders } from '@tanstack/react-start/server'
import {
  AdminFlamekeepersSchema,
  ConfirmGraduationSchema,
  ConfirmRelaySchema,
  ReleaseRelaySchema,
  StartDriveConnectSchema,
  relaySource,
  UpdateFlamekeeperSchema,
  type AdminFlamekeeperRow,
  type DrainStatus,
  type MyFlamekeeper,
  type RelayHandout,
} from './types'

async function resolveRelaySource(userId: string | undefined) {
  const { userContext } = await import('@/lib/auth/context')
  const { session } = await userContext()
  if (userId && userId !== session.user.id) {
    const { adminContext } = await import('@/lib/admin/server')
    await adminContext(['admin', 'manager'])
    return userId
  }
  return session.user.id
}

export const getMyFlamekeeperFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MyFlamekeeper | null> => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    let row = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()

    if (!row) return null
    if (row.state === 'draining') {
      const { finishDrainIfEmpty } = await import('@/lib/pool/drain-server')
      try {
        await finishDrainIfEmpty(database, session.user.id)
      } catch (error) {
        console.warn('Could not finish an empty drain:', error)
      }
      row =
        (await database
          .select()
          .from(flamekeeper)
          .where(eq(flamekeeper.userId, session.user.id))
          .get()) ?? row
    }
    const { countHostedAlbums } = await import('@/lib/pool/server')
    const { drainBytesLeft } = await import('@/lib/pool/drain')
    const { graduationConfirmDue } = await import('@/lib/pool/graduation')
    return {
      state: row.state,
      pledgedBytes: row.pledgedBytes,
      usedBytes: row.usedBytes,
      graduationDate: row.graduationDate,
      graduationConfirmDue: graduationConfirmDue(row, new Date()),
      drainingDeadline: row.drainingDeadline,
      drainReason: row.drainReason,
      drainBytesLeft: drainBytesLeft(row),
      lostSince: row.lostSince,
      albumsHosted: await countHostedAlbums(database, session.user.id),
    }
  }
)

export const startDriveConnectFn = createServerFn({ method: 'POST' })
  .validator(StartDriveConnectSchema)
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { env } = await import('cloudflare:workers')
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

    const { isMasterEmail, MASTER_FLAMEKEEPER_MESSAGE } =
      await import('./master')
    if (isMasterEmail(session.user.email, process.env.GOOGLE_MASTER_EMAIL)) {
      throw new Error(MASTER_FLAMEKEEPER_MESSAGE)
    }

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
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { gbToBytes, isValidGraduationDate, isValidPledgeGb } =
      await import('./rules')

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

    if (
      data.graduationDate !== existing.graduationDate &&
      !isValidGraduationDate(data.graduationDate)
    ) {
      throw new Error('Expected graduation date must be in the future')
    }

    const { changePledge } = await import('@/lib/pool/drain-server')
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
    const { flamekeeper } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { isValidGraduationDate } = await import('./rules')

    const existing = await database
      .select()
      .from(flamekeeper)
      .where(eq(flamekeeper.userId, session.user.id))
      .get()
    if (!existing) throw new Error('You are not a flamekeeper')

    const date = data.graduationDate ?? existing.graduationDate
    if (date !== existing.graduationDate && !isValidGraduationDate(date)) {
      throw new Error('Expected graduation date must be in the future')
    }
    const { changePledge } = await import('@/lib/pool/drain-server')
    await changePledge(database, session.user.id, {
      pledgedBytes: existing.pledgedBytes,
      graduationDate: date,
    })
    return { success: true }
  })

export const getAdminFlamekeepersFn = createServerFn({ method: 'GET' })
  .validator(AdminFlamekeepersSchema)
  .handler(async ({ data }): Promise<AdminFlamekeeperRow[]> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { database } = await adminContext(['admin', 'manager'])

    const { flamekeeper, user } = await import('@/db/schema')
    const { eq, like, or, desc } = await import('drizzle-orm')

    const { drainBytesLeft } = await import('@/lib/pool/drain')
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
        drainReason: flamekeeper.drainReason,
        drainingDeadline: flamekeeper.drainingDeadline,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
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
      drainingDeadline: row.drainingDeadline,
      drainBytesLeft: drainBytesLeft(row),
      bannedAt: row.bannedAt,
      banReason: row.banReason,
      createdAt: row.createdAt,
    }))
  })

export const optOutFlamekeeperFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<DrainStatus> => {
    const { userContext } = await import('@/lib/auth/context')
    const { session, database } = await userContext()
    const { optOutFlamekeeper } = await import('@/lib/pool/drain-server')
    return optOutFlamekeeper(database, session.user.id)
  }
)

export const startRelayFn = createServerFn({ method: 'POST' })
  .validator(relaySource)
  .handler(async ({ data }): Promise<RelayHandout> => {
    const sourceUserId = await resolveRelaySource(data.userId)
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { startRelay } = await import('@/lib/pool/drain-server')
    return startRelay(
      db(env.meriksirat_d1 as D1Database),
      sourceUserId,
      getRequestHeaders().get('origin') ?? new URL(getRequest().url).origin
    )
  })

export const confirmRelayFn = createServerFn({ method: 'POST' })
  .validator(ConfirmRelaySchema)
  .handler(async ({ data }): Promise<DrainStatus> => {
    const sourceUserId = await resolveRelaySource(data.userId)
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { confirmRelay } = await import('@/lib/pool/drain-server')
    return confirmRelay(db(env.meriksirat_d1 as D1Database), sourceUserId, {
      photoId: data.photoId,
      reservationId: data.reservationId,
      fileId: data.fileId,
    })
  })

export const releaseRelayFn = createServerFn({ method: 'POST' })
  .validator(ReleaseRelaySchema)
  .handler(async ({ data }) => {
    await resolveRelaySource(data.userId)
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { releaseFlamekeeperUpload } = await import('@/lib/pool/server')
    await releaseFlamekeeperUpload(
      db(env.meriksirat_d1 as D1Database),
      data.albumId,
      data.reservationId,
      data.quotaExceeded
    )
    return { success: true }
  })

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
        'Club members keep their account. Other accounts can be deleted once any flamekeeping has stopped and the photos have moved.'
      )
    }
    await database.delete(user).where(eq(user.id, session.user.id))
    return { success: true }
  }
)
