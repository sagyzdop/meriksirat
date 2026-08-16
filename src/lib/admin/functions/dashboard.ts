import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  AdminDashboardRangeSchema,
  AdminUserAlbumsFiltersSchema,
  BroadcastMessageSchema,
  ExportUsersFiltersSchema,
  MostActiveUsersFiltersSchema,
  ViolationsFiltersSchema,
} from '../dashboard-types'
import type {
  AdminDashboardStats,
  AdminUserAlbum,
  AdminUserExport,
  BookingStats,
  BroadcastResult,
  DashboardAlert,
  MostActiveUser,
  PaginatedAdminUserAlbumsResponse,
  PaginatedMostActiveUsersResponse,
  PaginatedViolationsResponse,
  ViolationRow,
  ViolationType,
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

function resolveRange(
  startDate?: string,
  endDate?: string
): {
  start: Date
  endOfRange: Date
} {
  const end = endDate ? new Date(endDate) : new Date()
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getFullYear(), end.getMonth() - 5, 1)
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
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { album, booking } = await import('@/db/schema')
    const { and, gte, lte, sql } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)
    const { start, endOfRange } = resolveRange(data.startDate, data.endDate)
    const rangeWhere = and(
      gte(album.createdAt, start),
      lte(album.createdAt, endOfRange)
    )

    // --- Albums per month (public vs private) -----------------------------
    const albumRows = await database
      .select({ createdAt: album.createdAt, isShared: album.isShared })
      .from(album)
      .where(rangeWhere)
      .all()

    const byMonth = new Map<string, { public: number; private: number }>()
    for (const key of monthKeysBetween(start, endOfRange)) {
      byMonth.set(key, { public: 0, private: 0 })
    }
    for (const row of albumRows) {
      const bucket = byMonth.get(monthKey(row.createdAt)) ?? {
        public: 0,
        private: 0,
      }
      if (row.isShared) bucket.public += 1
      else bucket.private += 1
      byMonth.set(monthKey(row.createdAt), bucket)
    }
    const albumsPerMonth = [...byMonth.entries()].map(([month, value]) => ({
      month,
      ...value,
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
      })
      .from(album)
      .where(rangeWhere)
      .all()

    let photoCount = 0
    let totalBytes = 0

    if (rangeAlbums.length > 0) {
      const { getCachedListing } = await import('@/lib/albums/server')
      const { getGoogleAccessToken } =
        await import('@/lib/google/google-calendar-auth')
      const { listDriveFolderFiles, DriveNotFoundError } =
        await import('@/lib/google/google-drive')

      // Reuse the per-album KV cache; only uncached albums hit the Drive API.
      const accessToken = await getGoogleAccessToken()
      for (let i = 0; i < rangeAlbums.length; i += 4) {
        const chunk = rangeAlbums.slice(i, i + 4)
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
  const { checkAdminPermission } = await import('@/lib/admin/server')
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db/index')
  const { booking, user, album } = await import('@/db/schema')
  const { eq, and, gte, lte, gt, or, isNull } = await import('drizzle-orm')

  const headers = getRequestHeaders()
  await checkAdminPermission(headers, ['admin', 'manager'])

  const database = db(env.meriksirat_d1 as D1Database)
  const now = new Date()
  const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000)

  const alerts: DashboardAlert[] = []

  const overdueCount = await database
    .select({ id: booking.id })
    .from(booking)
    .where(eq(booking.status, 'overdue'))
    .all()
  if (overdueCount.length > 0) {
    alerts.push({
      id: 'overdue-bookings',
      severity: 'danger',
      title: `${overdueCount.length} overdue booking${overdueCount.length === 1 ? '' : 's'}`,
      message: 'Equipment is overdue and needs to be returned.',
      href: '/admin/bookings',
    })
  }

  const activeCount = await database
    .select({ id: booking.id })
    .from(booking)
    .where(eq(booking.status, 'active'))
    .all()
  if (activeCount.length > 0) {
    alerts.push({
      id: 'active-bookings',
      severity: 'warning',
      title: `${activeCount.length} active booking${activeCount.length === 1 ? '' : 's'}`,
      message: 'Equipment is currently checked out.',
      href: '/admin/bookings',
    })
  }

  const upcoming = await database
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.status, 'booked'),
        gte(booking.startTime, now),
        lte(booking.startTime, in15Minutes)
      )
    )
    .all()
  if (upcoming.length > 0) {
    alerts.push({
      id: 'upcoming-bookings',
      severity: 'info',
      title: `${upcoming.length} booking${upcoming.length === 1 ? '' : 's'} start within 15 minutes`,
      message: 'Make sure the equipment is ready for pickup.',
      href: '/admin/bookings',
    })
  }

  const violators = await database
    .select({ id: user.id })
    .from(user)
    .where(
      or(gt(user.cancelledInStartWindowCount, 1), gt(user.overdueCount, 1))
    )
    .all()
  if (violators.length > 0) {
    alerts.push({
      id: 'repeated-violations',
      severity: 'warning',
      title: `${violators.length} user${violators.length === 1 ? '' : 's'} with 2+ violations`,
      message: 'Review users with repeated auto-cancelled or overdue bookings.',
      href: '/admin/users',
    })
  }

  const unlinked = await database
    .select({ id: user.id })
    .from(user)
    .where(or(isNull(user.telegramChatId), eq(user.telegramChatId, '')))
    .all()
  if (unlinked.length > 0) {
    alerts.push({
      id: 'unlinked-telegram',
      severity: 'info',
      title: `${unlinked.length} user${unlinked.length === 1 ? '' : 's'} without a linked Telegram account`,
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

// ---------------------------------------------------------------------------
// Most active users (owned + co-authored albums in range)
// ---------------------------------------------------------------------------

export const getAdminMostActiveUsersFn = createServerFn({ method: 'GET' })
  .validator(MostActiveUsersFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedMostActiveUsersResponse> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { user, album, albumMember } = await import('@/db/schema')
    const { eq, and, gte, lte, or, like, asc, desc, sql, aliasedTable } =
      await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)
    const { start, endOfRange } = resolveRange(data.startDate, data.endDate)

    const memberAlbum = aliasedTable(album, 'member_album')
    const albumCountExpr = sql<number>`count(distinct ${album.id}) + count(distinct ${memberAlbum.id})`

    const searchConditions: import('drizzle-orm').SQL[] = []
    if (data.search) {
      const term = `%${data.search}%`
      searchConditions.push(
        or(
          like(user.name, term),
          like(user.email, term),
          like(user.firstName, term),
          like(user.lastName, term)
        )!
      )
    }
    const whereClause = searchConditions.length
      ? and(...searchConditions)
      : undefined

    const offset = (data.page - 1) * data.limit
    const dir = data.sortOrder === 'desc' ? desc : asc
    const orderBy =
      data.sortBy === 'email'
        ? dir(user.email)
        : data.sortBy === 'createdAt'
          ? dir(user.createdAt)
          : data.sortBy === 'firstName'
            ? dir(user.firstName)
            : desc(albumCountExpr)

    const ownerJoin = and(
      eq(album.ownerUserId, user.id),
      gte(album.createdAt, start),
      lte(album.createdAt, endOfRange)
    )
    const memberJoin = and(
      eq(memberAlbum.id, albumMember.albumId),
      gte(memberAlbum.createdAt, start),
      lte(memberAlbum.createdAt, endOfRange)
    )
    const having = sql`count(distinct ${album.id}) + count(distinct ${memberAlbum.id}) > 0`

    const countRows = await database
      .select({ id: user.id })
      .from(user)
      .leftJoin(album, ownerJoin)
      .leftJoin(albumMember, eq(albumMember.userId, user.id))
      .leftJoin(memberAlbum, memberJoin)
      .where(whereClause)
      .groupBy(user.id)
      .having(having)
      .all()

    const rows = await database
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        albumCount: albumCountExpr,
      })
      .from(user)
      .leftJoin(album, ownerJoin)
      .leftJoin(albumMember, eq(albumMember.userId, user.id))
      .leftJoin(memberAlbum, memberJoin)
      .where(whereClause)
      .groupBy(user.id)
      .having(having)
      .orderBy(orderBy)
      .limit(data.limit)
      .offset(offset)
      .all()

    const users: MostActiveUser[] = rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      albumCount: Number(row.albumCount),
    }))

    const totalCount = countRows.length

    return {
      users,
      pagination: {
        page: data.page,
        limit: data.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / data.limit),
      },
    }
  })

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------

export const getViolationsFn = createServerFn({ method: 'GET' })
  .validator(ViolationsFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedViolationsResponse> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { user } = await import('@/db/schema')
    const { and, or, gt, like, asc, desc, count } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const conditions: import('drizzle-orm').SQL[] = [
      or(gt(user.cancelledInStartWindowCount, 0), gt(user.overdueCount, 0))!,
    ]

    if (data.search) {
      const term = `%${data.search}%`
      conditions.push(
        or(
          like(user.name, term),
          like(user.email, term),
          like(user.firstName, term),
          like(user.lastName, term)
        )!
      )
    }

    if (data.violationType?.length === 1) {
      if (data.violationType[0] === 'auto-cancelled') {
        conditions.push(gt(user.cancelledInStartWindowCount, 0))
      } else {
        conditions.push(gt(user.overdueCount, 0))
      }
    } else if ((data.violationType?.length ?? 0) > 1) {
      conditions.push(
        or(gt(user.cancelledInStartWindowCount, 0), gt(user.overdueCount, 0))!
      )
    }

    const whereClause = and(...conditions)
    const offset = (data.page - 1) * data.limit
    const dir = data.sortOrder === 'desc' ? desc : asc
    const orderBy =
      data.sortBy === 'email'
        ? dir(user.email)
        : data.sortBy === 'role'
          ? dir(user.role)
          : data.sortBy === 'status'
            ? dir(user.status)
            : data.sortBy === 'cancelledInStartWindowCount'
              ? dir(user.cancelledInStartWindowCount)
              : data.sortBy === 'overdueCount'
                ? dir(user.overdueCount)
                : dir(user.firstName)

    const [totalResult, rows] = await Promise.all([
      database.select({ count: count() }).from(user).where(whereClause),
      database
        .select({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
          cancelledInStartWindowCount: user.cancelledInStartWindowCount,
          overdueCount: user.overdueCount,
        })
        .from(user)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(data.limit)
        .offset(offset),
    ])

    const totalCount = totalResult[0]?.count || 0

    const users: ViolationRow[] = rows.map((row) => {
      const violationTypes: ViolationType[] = []
      if (row.cancelledInStartWindowCount > 0) {
        violationTypes.push('auto-cancelled')
      }
      if (row.overdueCount > 0) {
        violationTypes.push('overdue')
      }
      return { ...row, violationTypes }
    })

    return {
      users,
      pagination: {
        page: data.page,
        limit: data.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / data.limit),
      },
    }
  })

// ---------------------------------------------------------------------------
// User albums (admin user detail)
// ---------------------------------------------------------------------------

export const getAdminUserAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AdminUserAlbumsFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedAdminUserAlbumsResponse> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { album, albumMember } = await import('@/db/schema')
    const { eq, and, or, inArray, like, asc, desc, sql } =
      await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const memberRows = await database
      .select({ albumId: albumMember.albumId })
      .from(albumMember)
      .where(eq(albumMember.userId, data.userId))
      .all()
    const memberAlbumIds = memberRows.map((row) => row.albumId)

    const conditions: import('drizzle-orm').SQL[] = []
    if (memberAlbumIds.length > 0) {
      conditions.push(
        or(
          eq(album.ownerUserId, data.userId),
          inArray(album.id, memberAlbumIds)
        )!
      )
    } else {
      conditions.push(eq(album.ownerUserId, data.userId))
    }

    const search = (data.search ?? '').trim()
    if (search) {
      conditions.push(like(album.title, `%${search}%`))
    }

    const visibility = data.visibility ?? []
    if (visibility.length === 1) {
      conditions.push(
        visibility[0] === 'public'
          ? eq(album.isShared, true)
          : eq(album.isShared, false)
      )
    } else if (visibility.length > 1) {
      conditions.push(
        or(
          ...visibility.map((v) =>
            v === 'public'
              ? eq(album.isShared, true)
              : eq(album.isShared, false)
          )
        )!
      )
    }

    const whereClause = and(...conditions)
    const offset = (data.page - 1) * data.limit
    const coAuthorCountExpr = sql<number>`count(${albumMember.id})`
    const dir = data.sortOrder === 'desc' ? desc : asc
    const orderBy =
      data.sortBy === 'title'
        ? dir(album.title)
        : data.sortBy === 'isShared'
          ? dir(album.isShared)
          : data.sortBy === 'coAuthorCount'
            ? dir(coAuthorCountExpr)
            : dir(album.createdAt)

    const [countRows, pageRows] = await Promise.all([
      database
        .select({ id: album.id })
        .from(album)
        .leftJoin(albumMember, eq(albumMember.albumId, album.id))
        .where(whereClause)
        .groupBy(album.id)
        .all(),
      database
        .select({
          id: album.id,
          title: album.title,
          isShared: album.isShared,
          createdAt: album.createdAt,
          coAuthorCount: coAuthorCountExpr,
        })
        .from(album)
        .leftJoin(albumMember, eq(albumMember.albumId, album.id))
        .where(whereClause)
        .groupBy(album.id)
        .orderBy(orderBy)
        .limit(data.limit)
        .offset(offset)
        .all(),
    ])

    const albums: AdminUserAlbum[] = pageRows.map((row) => ({
      id: row.id,
      title: row.title,
      isShared: !!row.isShared,
      createdAt: row.createdAt.toISOString(),
      coAuthorCount: Number(row.coAuthorCount),
    }))

    const totalCount = countRows.length

    return {
      albums,
      pagination: {
        page: data.page,
        limit: data.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / data.limit),
      },
    }
  })

// ---------------------------------------------------------------------------
// User export (all matching users, no pagination)
// ---------------------------------------------------------------------------

export const exportUsersFn = createServerFn({ method: 'GET' })
  .validator(ExportUsersFiltersSchema)
  .handler(async ({ data }): Promise<AdminUserExport[]> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { user } = await import('@/db/schema')
    const { and, or, like, inArray } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const conditions: import('drizzle-orm').SQL[] = []
    if (data.role?.length) {
      conditions.push(inArray(user.role, data.role))
    }
    if (data.status?.length) {
      conditions.push(inArray(user.status, data.status))
    }
    if (data.clearanceLevel?.length) {
      conditions.push(inArray(user.clearanceLevel, data.clearanceLevel))
    }
    if (data.search) {
      const term = `%${data.search}%`
      conditions.push(
        or(
          like(user.name, term),
          like(user.email, term),
          like(user.firstName, term),
          like(user.lastName, term)
        )!
      )
    }
    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await database
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        clearanceLevel: user.clearanceLevel,
        firstName: user.firstName,
        lastName: user.lastName,
        instagramUsername: user.instagramUsername,
        nuId: user.nuId,
        telegramUsername: user.telegramUsername,
        telegramChatId: user.telegramChatId,
        major: user.major,
        graduationYear: user.graduationYear,
        onboardingComplete: user.onboardingComplete,
        cancelledInStartWindowCount: user.cancelledInStartWindowCount,
        overdueCount: user.overdueCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(whereClause)
      .orderBy(user.firstName)
      .all()

    return rows.map((row) => ({
      ...row,
      onboardingComplete: !!row.onboardingComplete,
    }))
  })

// ---------------------------------------------------------------------------
// Telegram broadcast (admin only)
// ---------------------------------------------------------------------------

export const broadcastTelegramMessageFn = createServerFn({ method: 'POST' })
  .validator(BroadcastMessageSchema)
  .handler(async ({ data }): Promise<BroadcastResult> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { user } = await import('@/db/schema')
    const { TelegramAPI } = await import('@/lib/telegram/api')
    const { formatUserDisplayName } = await import('@/lib/utils')

    const headers = getRequestHeaders()
    // Broadcasts reach every user with a linked chat, so only admins may send.
    await checkAdminPermission(headers, ['admin'])

    const database = db(env.meriksirat_d1 as D1Database)

    const allUsers = await database
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        telegramUsername: user.telegramUsername,
        telegramChatId: user.telegramChatId,
      })
      .from(user)
      .all()

    const total = allUsers.length
    const linked = allUsers.filter((row) => row.telegramChatId?.trim())
    const skipped = total - linked.length

    if (linked.length === 0) {
      return { total, linked: 0, sent: 0, failed: 0, skipped }
    }

    const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)

    let sent = 0
    let failed = 0

    // Telegram allows roughly 30 messages/second per bot; batch conservatively.
    const BATCH_SIZE = 25
    for (let i = 0; i < linked.length; i += BATCH_SIZE) {
      const batch = linked.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          const displayName = formatUserDisplayName({
            firstName: row.firstName,
            lastName: row.lastName,
            name: row.name,
            telegramUsername: row.telegramUsername,
          })
          await telegram.sendMessage(
            row.telegramChatId!,
            `${data.message}\n\n— ${displayName}`,
            { disable_web_page_preview: true }
          )
        })
      )
      for (const result of results) {
        if (result.status === 'fulfilled') sent += 1
        else failed += 1
      }
      if (i + BATCH_SIZE < linked.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Log a summary to the club channel for auditability.
    try {
      const channel = env.TELEGRAM_CLUB_CHANNEL_ID
      if (channel) {
        await telegram.sendMessage(
          channel,
          `Broadcast sent to ${sent} user(s)${failed ? `, ${failed} failed` : ''}.`,
          { disable_web_page_preview: true }
        )
      }
    } catch (error) {
      console.warn('Failed to log broadcast to the club channel:', error)
    }

    return { total, linked: linked.length, sent, failed, skipped }
  })
