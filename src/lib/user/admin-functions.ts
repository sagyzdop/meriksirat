import type { SQL } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import {
  AdminUserFiltersSchema,
  UpdateUserAdminSchema,
  GetUserByIdSchema,
  BulkUpdateUserClearanceSchema,
  ResetUserViolationCountersSchema,
  BanUserSchema,
  BulkBanUsersSchema,
  UnbanUserSchema,
} from './types'
import { buildPagination } from '@/lib/pagination'

export const getAdminUsersFn = createServerFn({ method: 'GET' })
  .validator(AdminUserFiltersSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { userSearch } = await import('@/lib/user/search')
    const { user, flamekeeper } = await import('@/db/schema')
    const { and, count, desc, asc, inArray, sql, eq } =
      await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const conditions: (SQL | undefined)[] = [eq(user.isMember, true)]

    if (data.role && data.role.length > 0) {
      conditions.push(inArray(user.role, data.role))
    }

    if (data.status && data.status.length > 0) {
      conditions.push(inArray(user.status, data.status))
    }

    if (data.clearanceLevel && data.clearanceLevel.length > 0) {
      conditions.push(inArray(user.clearanceLevel, data.clearanceLevel))
    }

    if (data.search) {
      conditions.push(userSearch(data.search))
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      clearanceLevel: user.clearanceLevel,
      albumCount: user.albumCount,
      createdAt: user.createdAt,
    }[data.sortBy]

    const orderBy = sortColumn
      ? data.sortOrder === 'desc'
        ? desc(sortColumn)
        : asc(sortColumn)
      : asc(user.firstName)

    const usersQuery = database
      .select({
        id: user.id,
        email: user.email,
        image: user.image,
        role: user.role,
        clearanceLevel: user.clearanceLevel,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        cancelledInStartWindowCount: user.cancelledInStartWindowCount,
        overdueCount: user.overdueCount,
        albumCount: user.albumCount,
        flamekeeperState: flamekeeper.state,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .leftJoin(flamekeeper, eq(flamekeeper.userId, user.id))
      .$dynamic()

    const countQuery = database.select({ count: count() }).from(user).$dynamic()

    const offset = (data.page - 1) * data.limit

    const [totalCountResult, users] = await Promise.all([
      countQuery.where(whereCondition || sql`1=1`),
      usersQuery
        .where(whereCondition || sql`1=1`)
        .orderBy(orderBy)
        .limit(data.limit)
        .offset(offset),
    ])

    const totalCount = totalCountResult[0]?.count || 0

    const result = {
      users,
      pagination: buildPagination(totalCount, data.page, data.limit),
    }

    return result
  })

export const updateUserAdminFn = createServerFn({ method: 'POST' })
  .validator(UpdateUserAdminSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { admin: adminUser, database } = await adminContext([
      'admin',
      'manager',
    ])

    const targetUser = await database
      .select({
        id: user.id,
        role: user.role,
        isMember: user.isMember,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, data.userId))
      .get()

    if (!targetUser) {
      throw new Error('User not found')
    }

    if (data.role && ['admin', 'manager'].includes(data.role)) {
      const { getAccessRules } = await import('@/lib/access/access-rules')
      if (!getAccessRules(targetUser).canHoldStaffRole) {
        throw new Error(
          'Only club members can be assigned the manager or admin role.'
        )
      }
    }

    if (data.role && ['admin', 'manager'].includes(data.role)) {
      if (adminUser.role !== 'admin') {
        throw new Error(
          'Insufficient permissions to assign admin or manager roles. Only admins can assign these roles.'
        )
      }
    }

    const { userId, ...fields } = data
    if (Object.values(fields).every((value) => value === undefined)) {
      throw new Error('No valid fields provided for update')
    }

    await database.update(user).set(fields).where(eq(user.id, userId))

    if (data.status !== undefined) {
      try {
        const { reconcileBirthdaysToCalendar } =
          await import('@/lib/birthdays/functions/birthdays')
        await reconcileBirthdaysToCalendar(database)
      } catch (syncError) {
        console.error('Failed to sync birthday to calendar:', syncError)
      }

      if (data.status === 'Inactive') {
        const { session: sessionTable } = await import('@/db/schema')
        const { eq: eqOp } = await import('drizzle-orm')
        await database
          .delete(sessionTable)
          .where(eqOp(sessionTable.userId, data.userId))
      }
    }

    const updatedUser = await database
      .select({
        id: user.id,
        email: user.email,
        role: user.role,
        clearanceLevel: user.clearanceLevel,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, data.userId))
      .get()

    return { user: updatedUser }
  })

export const bulkUpdateUserClearanceFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateUserClearanceSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { user } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    if (data.userIds.length === 0) {
      throw new Error('No user IDs provided')
    }

    await database
      .update(user)
      .set({ clearanceLevel: data.clearanceLevel })
      .where(inArray(user.id, data.userIds))

    return { success: true, count: data.userIds.length }
  })

export const getAdminUserByIdFn = createServerFn({ method: 'GET' })
  .validator(GetUserByIdSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const userData = await database
      .select({
        id: user.id,
        email: user.email,
        image: user.image,
        role: user.role,
        clearanceLevel: user.clearanceLevel,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        instagramUsername: user.instagramUsername,
        nuId: user.nuId,
        birthday: user.birthday,
        major: user.major,
        graduationDate: user.graduationDate,
        onboardingComplete: user.onboardingComplete,
        cancelledInStartWindowCount: user.cancelledInStartWindowCount,
        overdueCount: user.overdueCount,
        albumCount: user.albumCount,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, data.userId))
      .get()

    if (!userData) {
      throw new Error('User not found')
    }

    const { graduationDate, ...rest } = userData
    const { classOfYear } = await import('@/lib/graduation-date')
    return { ...rest, graduationYear: classOfYear(graduationDate) }
  })

export const resetUserViolationCountersFn = createServerFn({ method: 'POST' })
  .validator(ResetUserViolationCountersSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const result = await database
      .update(user)
      .set({ cancelledInStartWindowCount: 0, overdueCount: 0 })
      .where(eq(user.id, data.userId))

    if (result.meta.changes === 0) {
      throw new Error('User not found')
    }

    return { success: true }
  })

export const banUserFn = createServerFn({ method: 'POST' })
  .validator(BanUserSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { banUser } = await import('@/lib/pool/ban-server')

    const { admin: actor, database } = await adminContext(['admin'])
    await banUser(database, {
      actorId: actor.id,
      targetId: data.userId,
      reason: data.reason,
    })
    return { success: true }
  })

export const bulkBanUsersFn = createServerFn({ method: 'POST' })
  .validator(BulkBanUsersSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { banUser } = await import('@/lib/pool/ban-server')

    const { admin: actor, database } = await adminContext(['admin'])
    for (const targetId of data.userIds) {
      await banUser(database, {
        actorId: actor.id,
        targetId,
        reason: data.reason,
      })
    }
    return { success: true, count: data.userIds.length }
  })

export const unbanUserFn = createServerFn({ method: 'POST' })
  .validator(UnbanUserSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { unbanUser } = await import('@/lib/pool/ban-server')

    const { admin: actor, database } = await adminContext(['admin'])
    await unbanUser(database, {
      actorId: actor.id,
      targetId: data.userId,
    })
    return { success: true }
  })
