import type { SQL } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { AdminDashboardRangeSchema } from '../dashboard-types'
import type {
  AlbumStorageStats,
  BookingStats,
  DashboardAlert,
  FlamekeeperStats,
  MemberStats,
  StorageStats,
} from '../dashboard-types'

export function resolveRange(
  startDate?: string,
  endDate?: string
): {
  start: Date
  endOfRange: Date
} {
  const end = endDate ? new Date(endDate) : new Date()
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getFullYear(), end.getMonth(), 1)
  const endOfRange = new Date(end)
  endOfRange.setHours(23, 59, 59, 999)
  return { start, endOfRange }
}

export const getBookingStatsFn = createServerFn({ method: 'GET' })
  .validator(AdminDashboardRangeSchema)
  .handler(async ({ data }): Promise<BookingStats> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { booking } = await import('@/db/schema')
    const { and, gte, lte, sql } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const { start, endOfRange } = resolveRange(data.startDate, data.endDate)
    const rows = await database
      .select({ status: booking.status, count: sql<number>`count(*)` })
      .from(booking)
      .where(
        and(gte(booking.startTime, start), lte(booking.startTime, endOfRange))
      )
      .groupBy(booking.status)
      .all()

    const stats: BookingStats = {
      total: 0,
      booked: 0,
      active: 0,
      overdue: 0,
      returned: 0,
      cancelled: 0,
      partially_returned: 0,
    }
    for (const row of rows) {
      const key = row.status as keyof BookingStats
      if (key in stats) stats[key] = Number(row.count)
      stats.total += Number(row.count)
    }
    return stats
  })

export const getAlbumStatsFn = createServerFn({ method: 'GET' })
  .validator(AdminDashboardRangeSchema)
  .handler(async ({ data }): Promise<AlbumStorageStats> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { album } = await import('@/db/schema')
    const { and, gte, isNull, lte } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const { start, endOfRange } = resolveRange(data.startDate, data.endDate)
    const rangeAlbums = await database
      .select({
        id: album.id,
        driveFolderId: album.driveFolderId,
        photoCount: album.photoCount,
        photoBytes: album.photoBytes,
      })
      .from(album)
      .where(
        and(
          gte(album.eventDate, start),
          lte(album.eventDate, endOfRange),
          isNull(album.deletedAt)
        )
      )
      .all()

    let photoCount = 0
    let totalBytes = 0

    const unsynced: typeof rangeAlbums = []
    for (const row of rangeAlbums) {
      if (row.photoCount > 0) {
        photoCount += row.photoCount
        totalBytes += row.photoBytes
      } else {
        unsynced.push(row)
      }
    }

    if (unsynced.length > 0) {
      const { loadListingEntry } = await import('@/lib/albums/photo-store')
      const { listedMasterFiles } = await import('@/lib/albums/listing')
      const { getGoogleAccessToken } =
        await import('@/lib/google/google-calendar-auth')
      const { listDriveFolderFiles, DriveNotFoundError } =
        await import('@/lib/google/google-drive')

      const accessToken = await getGoogleAccessToken()
      for (let i = 0; i < unsynced.length; i += 4) {
        const chunk = unsynced.slice(i, i + 4)
        await Promise.all(
          chunk.map(async (row) => {
            try {
              let files = listedMasterFiles(
                await loadListingEntry(database, row.id)
              )
              if (!files) {
                files = await listDriveFolderFiles(
                  accessToken,
                  row.driveFolderId
                )
              }
              for (const file of files) {
                if (file.mimeType?.startsWith('image/')) {
                  photoCount += 1
                  if (file.size) totalBytes += Number(file.size)
                }
              }
            } catch (error) {
              if (!(error instanceof DriveNotFoundError)) {
                console.warn(
                  `Failed to read Drive listing for album ${row.id}:`,
                  error
                )
              }
            }
          })
        )
      }
    }

    return { albumCount: rangeAlbums.length, photoCount, totalBytes }
  })

export const getMemberStatsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MemberStats> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { user } = await import('@/db/schema')
    const { eq, gte, isNull, or, sql } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totals, roleRows, clearanceRows] = await Promise.all([
      database
        .select({
          total: sql<number>`count(*)`,
          newThisMonth: sql<number>`count(case when ${gte(user.createdAt, monthStart)} then 1 end)`,
          onboardingIncomplete: sql<number>`count(case when ${or(eq(user.onboardingComplete, false), isNull(user.onboardingComplete))} then 1 end)`,
          telegramUnlinked: sql<number>`count(case when ${or(isNull(user.telegramChatId), eq(user.telegramChatId, ''))} then 1 end)`,
        })
        .from(user)
        .get(),
      database
        .select({ role: user.role, count: sql<number>`count(*)` })
        .from(user)
        .groupBy(user.role)
        .all(),
      database
        .select({ level: user.clearanceLevel, count: sql<number>`count(*)` })
        .from(user)
        .groupBy(user.clearanceLevel)
        .all(),
    ])

    const roles: MemberStats['roles'] = { user: 0, manager: 0, admin: 0 }
    for (const row of roleRows) {
      roles[row.role ?? 'user'] += Number(row.count)
    }

    return {
      total: Number(totals?.total ?? 0),
      newThisMonth: Number(totals?.newThisMonth ?? 0),
      onboardingIncomplete: Number(totals?.onboardingIncomplete ?? 0),
      telegramUnlinked: Number(totals?.telegramUnlinked ?? 0),
      roles,
      clearance: clearanceRows
        .map((row) => ({ level: row.level ?? 1, count: Number(row.count) }))
        .sort((a, b) => a.level - b.level),
    }
  }
)

export const getFlamekeeperStatsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FlamekeeperStats> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { flamekeeper } = await import('@/db/schema')
    const { sql } = await import('drizzle-orm')
    const { loadCapBytes, loadPoolFlamekeepers, loadPoolLowAlertPercent } =
      await import('@/lib/pool/server')
    const { isPoolLow, poolStats } = await import('@/lib/pool/placement')

    const { database } = await adminContext(['admin', 'manager'])

    const [stateRows, fks, capBytes, alertPercent] = await Promise.all([
      database
        .select({ state: flamekeeper.state, count: sql<number>`count(*)` })
        .from(flamekeeper)
        .groupBy(flamekeeper.state)
        .all(),
      loadPoolFlamekeepers(database),
      loadCapBytes(database),
      loadPoolLowAlertPercent(database),
    ])

    const states: FlamekeeperStats['states'] = {
      active: 0,
      full: 0,
      draining: 0,
      lost: 0,
      drained: 0,
    }
    for (const row of stateRows) states[row.state] = Number(row.count)

    const stats = poolStats(fks, capBytes)
    return {
      states,
      pledgedBytes: stats.pledgedBytes,
      usedBytes: stats.usedBytes,
      freeBytes: stats.freeBytes,
      capBytes,
      poolLow: isPoolLow(stats, alertPercent),
      alertPercent,
    }
  }
)

export const getStorageStatsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StorageStats> => {
    const { getBufferUsageFn } = await import('@/lib/buffer/functions')
    const { getPoolOverviewFn } = await import('./pool')
    const [buffer, pool] = await Promise.all([
      getBufferUsageFn(),
      getPoolOverviewFn(),
    ])
    return { buffer, pool }
  }
)

export const getAdminDashboardAlertsFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<DashboardAlert[]> => {
  const { adminContext } = await import('@/lib/admin/server')
  const { booking, user, album } = await import('@/db/schema')
  const { eq, and, gte, lte, gt, ne, or, isNull, sql } =
    await import('drizzle-orm')

  const { database } = await adminContext(['admin', 'manager'])

  const now = new Date()
  const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000)

  const alerts: DashboardAlert[] = []

  const countWhere = (condition: SQL | undefined) =>
    sql<number>`count(case when ${condition} then 1 end)`

  const [bookingCounts, userCounts] = await Promise.all([
    database
      .select({
        overdue: countWhere(eq(booking.status, 'overdue')),
        active: countWhere(eq(booking.status, 'active')),
        upcoming: countWhere(
          and(
            eq(booking.status, 'booked'),
            gte(booking.startTime, now),
            lte(booking.startTime, in15Minutes)
          )
        ),
      })
      .from(booking)
      .get(),
    database
      .select({
        violators: countWhere(
          or(gt(user.cancelledInStartWindowCount, 1), gt(user.overdueCount, 1))
        ),
        unlinked: countWhere(
          or(isNull(user.telegramChatId), eq(user.telegramChatId, ''))
        ),
      })
      .from(user)
      .get(),
  ])
  const overdue = bookingCounts?.overdue ?? 0
  const active = bookingCounts?.active ?? 0
  const upcoming = bookingCounts?.upcoming ?? 0
  const violators = userCounts?.violators ?? 0
  const unlinked = userCounts?.unlinked ?? 0

  if (overdue > 0) {
    alerts.push({
      id: 'overdue-bookings',
      severity: 'danger',
      title: `${overdue} overdue booking${overdue === 1 ? '' : 's'}`,
      message: 'Equipment is overdue and needs to be returned.',
      href: '/admin/bookings',
    })
  }

  if (active > 0) {
    alerts.push({
      id: 'active-bookings',
      severity: 'warning',
      title: `${active} active booking${active === 1 ? '' : 's'}`,
      message: 'Equipment is currently checked out.',
      href: '/admin/bookings',
    })
  }

  if (upcoming > 0) {
    alerts.push({
      id: 'upcoming-bookings',
      severity: 'info',
      title: `${upcoming} booking${upcoming === 1 ? '' : 's'} start within 15 minutes`,
      message: 'Make sure the equipment is ready for pickup.',
      href: '/admin/bookings',
    })
  }

  if (violators > 0) {
    alerts.push({
      id: 'repeated-violations',
      severity: 'warning',
      title: `${violators} user${violators === 1 ? '' : 's'} with 2+ violations`,
      message: 'Review users with repeated auto-cancelled or overdue bookings.',
      href: '/admin/members',
    })
  }

  if (unlinked > 0) {
    alerts.push({
      id: 'unlinked-telegram',
      severity: 'info',
      title: `${unlinked} user${unlinked === 1 ? '' : 's'} without a linked Telegram account`,
      message: 'These users will not receive broadcasts or reminders.',
      href: '/admin/members',
    })
  }

  // Albums whose Drive folder was in the bin or deleted at the last listing.
  const problemAlbums = await database
    .select({ title: album.title })
    .from(album)
    .where(and(isNull(album.deletedAt), ne(album.folderState, 'ok')))
    .all()
  const problemTitles = problemAlbums.map((row) => row.title)
  if (problemTitles.length > 0) {
    const preview = problemTitles.slice(0, 3).join(', ')
    alerts.push({
      id: 'album-folders',
      severity: 'warning',
      title: `${problemTitles.length} album folder${problemTitles.length === 1 ? '' : 's'} need attention`,
      message: `In the Drive bin or missing: ${preview}${problemTitles.length > 3 ? '…' : ''}`,
      href: '/admin/albums',
    })
  }

  try {
    const { listBufferGrants } = await import('@/lib/buffer/grant')
    const { BUFFER_STATE_LABELS } = await import('@/lib/buffer/grant-rules')
    const broken = (await listBufferGrants(database)).find(
      (g) => g.status !== 'retiring' && g.state !== 'ok'
    )
    if (broken) {
      alerts.unshift({
        id: 'buffer-state',
        severity: 'danger',
        title: `Buffer account ${broken.email}: ${BUFFER_STATE_LABELS[broken.state]}`,
        message: 'Uploads and buffer photos are affected until this is fixed.',
        href: '/admin/settings/storage',
      })
    }
  } catch {
    // alert is best effort
  }

  return alerts
})
