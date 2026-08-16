import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  AdminUserFiltersSchema,
  UpdateUserAdminSchema,
  GetUserByIdSchema,
  UpdateUserProfileSchema,
  BulkUpdateUserClearanceSchema,
  ResetUserViolationCountersSchema,
  type UserProfile,
} from './types'

export const getUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<UserProfile | null> => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth/auth')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      return null
    }

    const sessionUser = session.user as typeof session.user & {
      onboardingComplete?: boolean | null
    }

    // Optimization: If user is not fully onboarded in the session, check the DB directly.
    // This allows us to catch the status change immediately without waiting for session refresh/expiry,
    // while keeping performance high for fully onboarded users (no extra DB call).
    if (!sessionUser.onboardingComplete) {
      const { db } = await import('@/db')
      const { user } = await import('@/db/schema')
      const { eq } = await import('drizzle-orm')
      const { env } = await import('cloudflare:workers')

      const database = db(env.meriksirat_d1 as D1Database)
      const freshUser = await database
        .select()
        .from(user)
        .where(eq(user.id, session.user.id))
        .get()

      if (freshUser) {
        return freshUser as UserProfile
      }
    }

    // session.user from better-auth contains the user table data.
    // We return it directly to avoid a redundant database hit on every page load.
    // The session is kept fresh by better-auth.
    return session.user as UserProfile
  }
)

/**
 * Get users with admin filtering, pagination, and search capabilities
 * Supports filtering by role, status, clearance level, and text search
 * Includes pagination and sorting functionality
 */
export const getAdminUsersFn = createServerFn({ method: 'GET' })
  .validator(AdminUserFiltersSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { like, or, and, count, desc, asc, inArray, sql } =
      await import('drizzle-orm')

    const headers = getRequestHeaders()

    // Check admin permissions - both admin and manager can view users
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Build WHERE conditions
    const conditions = []

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
      const searchTerm = `%${data.search}%`
      conditions.push(
        or(
          like(user.name, searchTerm),
          like(user.email, searchTerm),
          like(user.firstName, searchTerm),
          like(user.lastName, searchTerm)
        )
      )
    }

    // Combine conditions with AND logic
    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined

    // Apply sorting
    const sortColumn = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      clearanceLevel: user.clearanceLevel,
      createdAt: user.createdAt,
    }[data.sortBy]

    const orderBy = sortColumn
      ? data.sortOrder === 'desc'
        ? desc(sortColumn)
        : asc(sortColumn)
      : asc(user.firstName)

    // Build the main query
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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .$dynamic()

    // Get total count for pagination
    const countQuery = database.select({ count: count() }).from(user).$dynamic()

    // Apply WHERE conditions and execute queries
    const offset = (data.page - 1) * data.limit

    // Execute queries in parallel
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
      pagination: {
        page: data.page,
        limit: data.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / data.limit),
      },
    }

    return result
  })

/**
 * Update user information with admin privileges
 * Validates role assignment permissions - only admins can assign admin/manager roles
 * Supports updating role, clearance level, status, and profile information
 */
export const updateUserAdminFn = createServerFn({ method: 'POST' })
  .validator(UpdateUserAdminSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()

    // Check admin permissions and get admin user info
    const adminUser = await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if target user exists
    const targetUser = await database
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, data.userId))
      .get()

    if (!targetUser) {
      throw new Error('User not found')
    }

    // Validate role assignment permissions
    if (data.role && ['admin', 'manager'].includes(data.role)) {
      if (adminUser.role !== 'admin') {
        throw new Error(
          'Insufficient permissions to assign admin or manager roles. Only admins can assign these roles.'
        )
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof user.$inferInsert> = {}

    if (data.role !== undefined) {
      updateData.role = data.role
    }

    if (data.clearanceLevel !== undefined) {
      updateData.clearanceLevel = data.clearanceLevel
    }

    if (data.status !== undefined) {
      updateData.status = data.status
    }

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName
    }

    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields provided for update')
    }

    // Perform the update
    await database.update(user).set(updateData).where(eq(user.id, data.userId))

    if (data.status !== undefined) {
      try {
        const { reconcileBirthdaysToCalendar } =
          await import('@/lib/birthdays/functions/birthdays')
        await reconcileBirthdaysToCalendar(database)
      } catch (syncError) {
        console.error('Failed to sync birthday to calendar:', syncError)
      }
    }

    // Return updated user data
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

/**
 * Bulk update user clearance levels
 * Only admins and managers can perform bulk updates
 */
export const bulkUpdateUserClearanceFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateUserClearanceSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    if (data.userIds.length === 0) {
      throw new Error('No user IDs provided')
    }

    await database
      .update(user)
      .set({ clearanceLevel: data.clearanceLevel })
      .where(inArray(user.id, data.userIds))

    return { success: true, count: data.userIds.length }
  })

/**
 * Get a specific user by ID for admin purposes
 * Used for user detail views and edit forms
 */
export const getAdminUserByIdFn = createServerFn({ method: 'GET' })
  .validator(GetUserByIdSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()

    // Check admin permissions
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

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
        graduationYear: user.graduationYear,
        onboardingComplete: user.onboardingComplete,
        cancelledInStartWindowCount: user.cancelledInStartWindowCount,
        overdueCount: user.overdueCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, data.userId))
      .get()

    if (!userData) {
      throw new Error('User not found')
    }

    return userData
  })

/**
 * Reset a user's violation counters (auto-cancelled bookings and overdue returns).
 * Only admins and managers can reset counters.
 */
export const resetUserViolationCountersFn = createServerFn({ method: 'POST' })
  .validator(ResetUserViolationCountersSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const result = await database
      .update(user)
      .set({ cancelledInStartWindowCount: 0, overdueCount: 0 })
      .where(eq(user.id, data.userId))

    if (result.meta.changes === 0) {
      throw new Error('User not found')
    }

    return { success: true }
  })

/**
 * Update user's own profile information
 * Users can update their personal information but not role/status/clearance
 */
export const updateUserProfileFn = createServerFn({ method: 'POST' })
  .validator(UpdateUserProfileSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { auth } = await import('@/lib/auth/auth')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({
      headers,
    })

    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    // Build update object with only provided fields
    const updateData: Partial<typeof user.$inferInsert> = {}

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName
    }

    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName
    }

    if (data.instagramUsername !== undefined) {
      updateData.instagramUsername = data.instagramUsername
    }

    if (data.nuId !== undefined) {
      updateData.nuId = data.nuId
    }

    if (data.birthday !== undefined) {
      updateData.birthday = data.birthday
    }

    if (data.major !== undefined) {
      updateData.major = data.major
    }

    if (data.graduationYear !== undefined) {
      updateData.graduationYear = data.graduationYear
    }

    if (data.image !== undefined) {
      updateData.image = data.image
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields provided for update')
    }

    // Perform the update
    await database
      .update(user)
      .set(updateData)
      .where(eq(user.id, session.user.id))

    if (data.birthday !== undefined) {
      try {
        const { reconcileBirthdaysToCalendar } =
          await import('@/lib/birthdays/functions/birthdays')
        await reconcileBirthdaysToCalendar(database)
      } catch (syncError) {
        console.error('Failed to sync birthday to calendar:', syncError)
      }
    }

    // Return updated user data
    const updatedUser = await database
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    return updatedUser
  })
