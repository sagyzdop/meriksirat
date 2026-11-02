import type { SQL } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { AdminDashboardRangeSchema } from '../dashboard-types'
import type {
  AdminDashboardStats,
  BookingStats,
  DashboardAlert,
} from '../dashboard-types'

// ---------------------------------------------------------------------------
// Helpers (pure, server-safe)
// ---------------------------------------------------------------------------

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Ordered `YYYY-MM` keys covering every month from `start` to `end` inclusive. */
function monthKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = []
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
  )
  const endKey = monthKey(end)
  while (monthKey(cursor) <= endKey) {
    keys.push(monthKey(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    if (keys.length > 120) break // safety valve against malformed ranges
  }
  return keys
}

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

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------

export const getAdminDashboardStatsFn = createServerFn({ method: 'GET' })
  .validator(AdminDashboardRangeSchema)
  .handler(async ({ data }): Promise<AdminDashboardStats> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { album, booking } = await import('@/db/schema')
    const { and, gte, isNull, lte, sql } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const { start, endOfRange } = resolveRange(data.startDate, data.endDate)
    const rangeWhere = and(
      gte(album.createdAt, start),
      lte(album.createdAt, endOfRange),
      isNull(album.deletedAt)
    )

    // --- Albums per month -------------------------------------------------
    const albumRows = await database
      .select({ createdAt: album.createdAt })
      .from(album)
      .where(rangeWhere)
      .all()

    const byMonth = new Map<string, number>()
    for (const key of monthKeysBetween(start, endOfRange)) {
      byMonth.set(key, 0)
    }
    for (const row of albumRows) {
      const key = monthKey(row.createdAt)
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
    }
    const albumsPerMonth = [...byMonth.entries()].map(([month, count]) => ({
      month,
      count,
    }))

    // --- Booking statistics by status (scoped to bookings starting in range)
    const bookingRows = await database
      .select({ status: booking.status, count: sql<number>`count(*)` })
      .from(booking)
      .where(
        and(gte(booking.startTime, start), lte(booking.startTime, endOfRange))
      )
      .groupBy(booking.status)
      .all()

    const bookingStats: BookingStats = {
      total: 0,
      booked: 0,
      active: 0,
      overdue: 0,
      returned: 0,
      cancelled: 0,
      partially_returned: 0,
    }
    for (const row of bookingRows) {
      const key = row.status as keyof BookingStats
      if (key in bookingStats) bookingStats[key] = Number(row.count)
      bookingStats.total += Number(row.count)
    }

    // --- Album storage (photos + bytes) within the range ------------------
    const rangeAlbums = await database
      .select({
        id: album.id,
        driveFolderId: album.driveFolderId,
        photoCount: album.photoCount,
        photoBytes: album.photoBytes,
        photosIndexedAt: album.photosIndexedAt,
      })
      .from(album)
      .where(rangeWhere)
      .all()

    let photoCount = 0
    let totalBytes = 0

    const unindexedAlbums: typeof rangeAlbums = []
    for (const row of rangeAlbums) {
      if (row.photosIndexedAt) {
        photoCount += row.photoCount
        totalBytes += row.photoBytes
      } else {
        unindexedAlbums.push(row)
      }
    }

    if (unindexedAlbums.length > 0) {
      const { getCachedListing } = await import('@/lib/albums/server')
      const { getGoogleAccessToken } =
        await import('@/lib/google/google-calendar-auth')
      const { listDriveFolderFiles, DriveNotFoundError } =
        await import('@/lib/google/google-drive')

      // Reuse the per-album KV cache; only uncached albums hit the Drive API.
      const accessToken = await getGoogleAccessToken()
      for (let i = 0; i < unindexedAlbums.length; i += 4) {
        const chunk = unindexedAlbums.slice(i, i + 4)
        await Promise.all(
          chunk.map(async (row) => {
            try {
              let files = (await getCachedListing(row.driveFolderId))?.files
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

    return {
      albumsPerMonth,
      bookingStats,
      albumStorage: {
        albumCount: rangeAlbums.length,
        photoCount,
        totalBytes,
      },
    }
  })

// ---------------------------------------------------------------------------
// Dashboard alerts
// ---------------------------------------------------------------------------

export const getAdminDashboardAlertsFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<DashboardAlert[]> => {
  const { adminContext } = await import('@/lib/admin/server')
  const { booking, user, album } = await import('@/db/schema')
  const { eq, and, gte, lte, gt, or, isNull, sql } = await import('drizzle-orm')

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
      href: '/admin/users',
    })
  }

  if (unlinked > 0) {
    alerts.push({
      id: 'unlinked-telegram',
      severity: 'info',
      title: `${unlinked} user${unlinked === 1 ? '' : 's'} without a linked Telegram account`,
      message: 'These users will not receive broadcasts or reminders.',
      href: '/admin/users',
    })
  }

  // Albums whose Drive folder is in the bin or deleted (cached state only,
  // so this is cheap — it never calls the Drive API).
  const albumRows = await database
    .select({
      id: album.id,
      title: album.title,
      driveFolderId: album.driveFolderId,
    })
    .from(album)
    .where(isNull(album.deletedAt))
    .all()

  const problemTitles: string[] = []
  if (albumRows.length > 0) {
    const { getCachedListing } = await import('@/lib/albums/server')
    await Promise.all(
      albumRows.map(async (row) => {
        try {
          const cached = await getCachedListing(row.driveFolderId)
          if (cached && cached.folderState !== 'ok') {
            problemTitles.push(row.title)
          }
        } catch {
          // ignore cache read failures
        }
      })
    )
  }
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

  return alerts
})
