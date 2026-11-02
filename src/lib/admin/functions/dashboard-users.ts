import { createServerFn } from '@tanstack/react-start'
import { albumCoverUrl } from '@/lib/albums/urls'
import {
  AdminUserAlbumsFiltersSchema,
  ExportUsersFiltersSchema,
  MostActiveUsersFiltersSchema,
  ViolationsFiltersSchema,
} from '../dashboard-types'
import type {
  AdminUserAlbum,
  AdminUserExport,
  MostActiveUser,
  PaginatedAdminUserAlbumsResponse,
  PaginatedMostActiveUsersResponse,
  PaginatedViolationsResponse,
  ViolationRow,
  ViolationType,
} from '../dashboard-types'
import { buildPagination } from '@/lib/pagination'

import { resolveRange } from './dashboard-stats'

export const getAdminMostActiveUsersFn = createServerFn({ method: 'GET' })
  .validator(MostActiveUsersFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedMostActiveUsersResponse> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { userSearch } = await import('@/lib/user/search')
    const { user, album, albumMember } = await import('@/db/schema')
    const { eq, and, gte, lte, asc, desc, sql, aliasedTable } =
      await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const { start, endOfRange } = resolveRange(data.startDate, data.endDate)

    const memberAlbum = aliasedTable(album, 'member_album')
    const albumCountExpr = sql<number>`count(distinct ${album.id}) + count(distinct ${memberAlbum.id})`

    const searchConditions: import('drizzle-orm').SQL[] = []
    if (data.search) {
      searchConditions.push(userSearch(data.search))
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
      pagination: buildPagination(totalCount, data.page, data.limit),
    }
  })

export const getViolationsFn = createServerFn({ method: 'GET' })
  .validator(ViolationsFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedViolationsResponse> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { userSearch } = await import('@/lib/user/search')
    const { user } = await import('@/db/schema')
    const { and, or, gt, asc, desc, count } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const conditions: import('drizzle-orm').SQL[] = [
      or(gt(user.cancelledInStartWindowCount, 0), gt(user.overdueCount, 0))!,
    ]

    if (data.search) {
      conditions.push(userSearch(data.search))
    }

    if (data.violationType?.length === 1) {
      if (data.violationType[0] === 'auto-cancelled') {
        conditions.push(gt(user.cancelledInStartWindowCount, 0))
      } else {
        conditions.push(gt(user.overdueCount, 0))
      }
    }

    const whereClause = and(...conditions)
    const offset = (data.page - 1) * data.limit
    const dir = data.sortOrder === 'desc' ? desc : asc
    const sortColumn = {
      firstName: user.firstName,
      email: user.email,
      role: user.role,
      status: user.status,
      cancelledInStartWindowCount: user.cancelledInStartWindowCount,
      overdueCount: user.overdueCount,
    }[data.sortBy]
    const orderBy = dir(sortColumn)

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
      pagination: buildPagination(totalCount, data.page, data.limit),
    }
  })

export const getAdminUserAlbumsFn = createServerFn({ method: 'GET' })
  .validator(AdminUserAlbumsFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedAdminUserAlbumsResponse> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { album, albumMember } = await import('@/db/schema')
    const { eq, and, or, inArray, isNull, like, asc, desc, sql } =
      await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    // D1 caps bound parameters at 100/query, so membership is expressed as a
    // subquery rather than an in-memory id list.
    const memberAlbums = database
      .select({ albumId: albumMember.albumId })
      .from(albumMember)
      .where(eq(albumMember.userId, data.userId))

    const conditions: import('drizzle-orm').SQL[] = [isNull(album.deletedAt)]
    conditions.push(
      or(eq(album.ownerUserId, data.userId), inArray(album.id, memberAlbums))!
    )

    const search = (data.search ?? '').trim()
    if (search) {
      conditions.push(like(album.title, `%${search}%`))
    }

    const whereClause = and(...conditions)
    const offset = (data.page - 1) * data.limit
    const coAuthorCountExpr = sql<number>`count(${albumMember.id})`
    const dir = data.sortOrder === 'desc' ? desc : asc
    const orderBy =
      data.sortBy === 'title'
        ? dir(album.title)
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
          createdAt: album.createdAt,
          coverFileId: album.coverFileId,
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
      createdAt: row.createdAt.toISOString(),
      coAuthorCount: Number(row.coAuthorCount),
      coverUrl: row.coverFileId ? albumCoverUrl(row.coverFileId) : null,
    }))

    const totalCount = countRows.length

    return {
      albums,
      pagination: buildPagination(totalCount, data.page, data.limit),
    }
  })

export const exportUsersFn = createServerFn({ method: 'GET' })
  .validator(ExportUsersFiltersSchema)
  .handler(async ({ data }): Promise<AdminUserExport[]> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { userSearch } = await import('@/lib/user/search')
    const { user } = await import('@/db/schema')
    const { and, inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

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
      conditions.push(userSearch(data.search))
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
        birthday: user.birthday,
        onboardingComplete: user.onboardingComplete,
        cancelledInStartWindowCount: user.cancelledInStartWindowCount,
        overdueCount: user.overdueCount,
        albumCount: user.albumCount,
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
