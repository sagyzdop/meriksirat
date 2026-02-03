import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { 
  AdminUserFiltersSchema, 
  UpdateUserAdminSchema,
  GetUserByIdSchema,
  UpdateUserProfileSchema
} from './types'

export const getUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
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
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const userData = await database
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()

    return userData
  }
)

/**
 * Get users with admin filtering, pagination, and search capabilities
 * Supports filtering by role, status, clearance level, and text search
 * Includes pagination and sorting functionality
 */
export const getAdminUsersFn = createServerFn({ method: 'GET' })
  .inputValidator(AdminUserFiltersSchema)
  .handler(async ({ data }) => {
    console.log('[getAdminUsersFn] Starting with data:', data)
    
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq, like, or, and, count, desc, asc } = await import('drizzle-orm')
    
    const headers = getRequestHeaders()
    
    // Check admin permissions - both admin and manager can view users
    await checkAdminPermission(headers, ['admin', 'manager'])
    
    console.log('[getAdminUsersFn] Admin permission check passed')
    
    const database = db(env.meriksirat_d1 as D1Database)
    
    // Build WHERE conditions
    const conditions = []
    
    if (data.role) {
      conditions.push(eq(user.role, data.role))
    }
    
    if (data.status) {
      conditions.push(eq(user.status, data.status))
    }
    
    if (data.clearanceLevel) {
      conditions.push(eq(user.clearanceLevel, data.clearanceLevel))
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
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined
    
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
    
    const orderBy = sortColumn ? (data.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)) : asc(user.firstName)
    
    // Build the main query
    const usersQuery = database
      .select({
        id: user.id,
        email: user.email,
        role: user.role,
        clearanceLevel: user.clearanceLevel,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .$dynamic()
    
    // Get total count for pagination
    const countQuery = database
      .select({ count: count() })
      .from(user)
      .$dynamic()
    
    // Apply WHERE conditions and execute queries
    const offset = (data.page - 1) * data.limit
    
    let users, totalCountResult
    
    if (whereCondition) {
      users = await usersQuery.where(whereCondition).orderBy(orderBy).limit(data.limit).offset(offset)
      totalCountResult = await countQuery.where(whereCondition)
    } else {
      users = await usersQuery.orderBy(orderBy).limit(data.limit).offset(offset)
      totalCountResult = await countQuery
    }
    
    const totalCount = totalCountResult[0]?.count || 0
    
    console.log('[getAdminUsersFn] Query results:', {
      usersCount: users.length,
      totalCount,
      page: data.page,
      limit: data.limit
    })
    
    const result = {
      users,
      pagination: {
        page: data.page,
        limit: data.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / data.limit),
      },
    }
    
    console.log('[getAdminUsersFn] Returning result:', result)
    
    return result
  })

/**
 * Update user information with admin privileges
 * Validates role assignment permissions - only admins can assign admin/manager roles
 * Supports updating role, clearance level, status, and profile information
 */
export const updateUserAdminFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateUserAdminSchema)
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
        throw new Error('Insufficient permissions to assign admin or manager roles. Only admins can assign these roles.')
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
    await database
      .update(user)
      .set(updateData)
      .where(eq(user.id, data.userId))
    
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
 * Get a specific user by ID for admin purposes
 * Used for user detail views and edit forms
 */
export const getAdminUserByIdFn = createServerFn({ method: 'GET' })
  .inputValidator(GetUserByIdSchema)
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
 * Update user's own profile information
 * Users can update their personal information but not role/status/clearance
 */
export const updateUserProfileFn = createServerFn({ method: 'POST' })
  .inputValidator(UpdateUserProfileSchema)
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
    
    // Return updated user data
    const updatedUser = await database
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .get()
    
    return updatedUser
  })
