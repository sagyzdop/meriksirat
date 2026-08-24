import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import type {
  PaginatedEquipmentResponse,
  EquipmentResponse,
  EquipmentWithCategory,
} from './types'
import {
  EQUIPMENT_MIN_CLEARANCE,
  EquipmentFiltersSchema,
  AdminEquipmentFiltersSchema,
  CreateEquipmentSchema,
  UpdateEquipmentSchema,
  DeleteEquipmentSchema,
  UploadEquipmentImageSchema,
  BulkUpdateEquipmentClearanceSchema,
} from './types'
import { getUserClearanceLevel } from './server'

export const getEquipmentFn = createServerFn({
  method: 'GET',
})
  .validator(EquipmentFiltersSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, category } = await import('@/db/schema')
    const { eq, and, gte, lte, like, or, asc, desc, inArray } =
      await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await resolveSession(headers)

    if (!session?.user) {
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const userClearanceLevel = await getUserClearanceLevel(session.user.id)

    if (userClearanceLevel < EQUIPMENT_MIN_CLEARANCE) {
      return null
    }

    const sortBy = data.sortBy ?? 'modelName'
    const sortOrder = data.sortOrder ?? 'asc'

    // Build where conditions
    const conditions = [
      lte(equipment.requiredClearanceLevel, userClearanceLevel),
    ]

    // Add active status filter
    if (data.isActive && data.isActive.length > 0) {
      conditions.push(inArray(equipment.isActive, data.isActive))
    } else {
      // Default to showing only active equipment for users if no filter is applied
      conditions.push(eq(equipment.isActive, true))
    }

    // Add category filter
    if (data.categoryIds && data.categoryIds.length > 0) {
      conditions.push(inArray(equipment.categoryId, data.categoryIds))
    }

    // Add search query filter
    if (data.searchQuery) {
      const searchTerm = `%${data.searchQuery}%`
      conditions.push(
        or(
          like(equipment.modelName, searchTerm),
          like(equipment.description, searchTerm),
          like(category.name, searchTerm)
        )!
      )
    }

    // Add clearance level range filters
    if (data.minClearanceLevel !== undefined) {
      conditions.push(
        gte(equipment.requiredClearanceLevel, data.minClearanceLevel)
      )
    }
    if (data.maxClearanceLevel !== undefined) {
      conditions.push(
        lte(equipment.requiredClearanceLevel, data.maxClearanceLevel)
      )
    }

    const whereClause = and(...conditions)

    // Apply sorting
    const sortColumn = {
      modelName: equipment.modelName,
      category: category.name,
      requiredClearanceLevel: equipment.requiredClearanceLevel,
      isActive: equipment.isActive,
      createdAt: equipment.createdAt,
    }[sortBy]

    const orderBy = sortColumn
      ? sortOrder === 'desc'
        ? desc(sortColumn)
        : asc(sortColumn)
      : asc(equipment.modelName)

    const equipmentListQuery = database
      .select({
        id: equipment.id,
        modelName: equipment.modelName,
        description: equipment.description,
        categoryId: equipment.categoryId,
        googleCalendarId: equipment.googleCalendarId,
        requiredClearanceLevel: equipment.requiredClearanceLevel,
        imagePath: equipment.imagePath,
        isActive: equipment.isActive,
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt,
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      })
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(whereClause)
      .orderBy(orderBy)

    const equipmentList = await equipmentListQuery

    const response: EquipmentResponse = {
      data: equipmentList as EquipmentWithCategory[],
    }

    return response
  })

export const getEquipmentByIdFn = createServerFn({
  method: 'GET',
})
  .validator(z.object({ equipmentId: z.coerce.number() }))
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, category } = await import('@/db/schema')
    const { eq, and, lte } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    const session = await resolveSession(headers)

    if (!session?.user) {
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const userClearanceLevel = await getUserClearanceLevel(session.user.id)

    if (userClearanceLevel < EQUIPMENT_MIN_CLEARANCE) {
      return null
    }

    const equipmentItem = await database
      .select({
        id: equipment.id,
        modelName: equipment.modelName,
        description: equipment.description,
        categoryId: equipment.categoryId,
        googleCalendarId: equipment.googleCalendarId,
        requiredClearanceLevel: equipment.requiredClearanceLevel,
        imagePath: equipment.imagePath,
        isActive: equipment.isActive,
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt,
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      })
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(
        and(
          eq(equipment.id, data.equipmentId),
          eq(equipment.isActive, true),
          lte(equipment.requiredClearanceLevel, userClearanceLevel)
        )
      )
      .limit(1)

    return equipmentItem[0] as EquipmentWithCategory | undefined
  })

export const getCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    // Import server-only code inside handler
    const { resolveSession } = await import('@/lib/auth/resolve-session')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { category } = await import('@/db/schema')

    const headers = getRequestHeaders()
    const session = await resolveSession(headers)

    if (!session?.user) {
      return null
    }

    if (
      (await getUserClearanceLevel(session.user.id)) < EQUIPMENT_MIN_CLEARANCE
    ) {
      return null
    }

    const database = db(env.meriksirat_d1 as D1Database)
    const categories = await database
      .select()
      .from(category)
      .orderBy(category.sortOrder, category.name)

    return categories
  }
)

// Admin Equipment Management Functions

/**
 * Create new equipment (Admin only)
 * Validates Google Calendar ID uniqueness and admin permissions
 */
export const createEquipmentAdminFn = createServerFn({ method: 'POST' })
  .validator(CreateEquipmentSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if Google Calendar ID already exists
    const existingEquipment = await database
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.googleCalendarId, data.googleCalendarId))
      .get()

    if (existingEquipment) {
      throw new Error(
        'Google Calendar ID already exists. Each equipment must have a unique calendar.'
      )
    }

    // Verify category exists
    const categoryExists = await database
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, data.categoryId))
      .get()

    if (!categoryExists) {
      throw new Error('Selected category does not exist')
    }

    const result = await database
      .insert(equipment)
      .values({
        modelName: data.modelName,
        shortName: data.shortName ?? null,
        description: data.description ?? null,
        categoryId: data.categoryId,
        googleCalendarId: data.googleCalendarId,
        requiredClearanceLevel: data.requiredClearanceLevel,
        imagePath: data.imagePath ?? null,
        isActive: true,
      })
      .returning({ id: equipment.id })

    return { equipmentId: result[0]?.id }
  })

/**
 * Update existing equipment (Admin only)
 * Validates Google Calendar ID uniqueness and admin permissions
 */
export const updateEquipmentAdminFn = createServerFn({ method: 'POST' })
  .validator(UpdateEquipmentSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, category } = await import('@/db/schema')
    const { eq, and, ne } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if equipment exists
    const existingEquipment = await database
      .select({
        id: equipment.id,
        googleCalendarId: equipment.googleCalendarId,
      })
      .from(equipment)
      .where(eq(equipment.id, data.equipmentId))
      .get()

    if (!existingEquipment) {
      throw new Error('Equipment not found')
    }

    // Check Google Calendar ID uniqueness if it's being updated
    if (
      data.googleCalendarId &&
      data.googleCalendarId !== existingEquipment.googleCalendarId
    ) {
      const calendarIdConflict = await database
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(
            eq(equipment.googleCalendarId, data.googleCalendarId),
            ne(equipment.id, data.equipmentId)
          )
        )
        .get()

      if (calendarIdConflict) {
        throw new Error(
          'Google Calendar ID already exists. Each equipment must have a unique calendar.'
        )
      }
    }

    // Verify category exists if it's being updated
    if (data.categoryId) {
      const categoryExists = await database
        .select({ id: category.id })
        .from(category)
        .where(eq(category.id, data.categoryId))
        .get()

      if (!categoryExists) {
        throw new Error('Selected category does not exist')
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (data.modelName !== undefined) updateData.modelName = data.modelName
    if (data.shortName !== undefined) updateData.shortName = data.shortName
    if (data.description !== undefined)
      updateData.description = data.description
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
    if (data.googleCalendarId !== undefined)
      updateData.googleCalendarId = data.googleCalendarId
    if (data.requiredClearanceLevel !== undefined)
      updateData.requiredClearanceLevel = data.requiredClearanceLevel
    if (data.imagePath !== undefined) updateData.imagePath = data.imagePath
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    await database
      .update(equipment)
      .set(updateData)
      .where(eq(equipment.id, data.equipmentId))

    return { success: true }
  })

/**
 * Bulk update required clearance level for multiple equipment (Admin only)
 */
export const bulkUpdateEquipmentClearanceFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateEquipmentClearanceSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    if (data.equipmentIds.length === 0) {
      throw new Error('No equipment IDs provided')
    }

    await database
      .update(equipment)
      .set({ requiredClearanceLevel: data.requiredClearanceLevel })
      .where(inArray(equipment.id, data.equipmentIds))

    return { success: true, count: data.equipmentIds.length }
  })

/**
 * Delete equipment (Admin only)
 * Prevents deletion of equipment with active bookings by marking as inactive instead
 */
export const deleteEquipmentAdminFn = createServerFn({ method: 'POST' })
  .validator(DeleteEquipmentSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, booking, bookingItem } = await import('@/db/schema')
    const { eq, and, or, sql } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if equipment exists
    const equipmentToDelete = await database
      .select({
        id: equipment.id,
        modelName: equipment.modelName,
        isActive: equipment.isActive,
      })
      .from(equipment)
      .where(eq(equipment.id, data.equipmentId))
      .get()

    if (!equipmentToDelete) {
      throw new Error('Equipment not found')
    }

    // Check for active bookings
    const activeBookings = await database
      .select({ count: sql<number>`count(*)` })
      .from(bookingItem)
      .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
      .where(
        and(
          eq(bookingItem.equipmentId, data.equipmentId),
          or(
            eq(booking.status, 'booked'),
            eq(booking.status, 'active'),
            eq(booking.status, 'overdue'),
            eq(booking.status, 'partially_returned')
          )!
        )
      )

    const hasActiveBookings = (activeBookings[0]?.count || 0) > 0

    if (hasActiveBookings) {
      // Mark as inactive instead of deleting
      await database
        .update(equipment)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(equipment.id, data.equipmentId))

      return {
        success: true,
        action: 'deactivated',
        message: `Equipment "${equipmentToDelete.modelName}" has been marked as inactive due to active bookings. It will no longer be available for new bookings.`,
      }
    } else {
      // Safe to delete - no active bookings
      await database.delete(equipment).where(eq(equipment.id, data.equipmentId))

      return {
        success: true,
        action: 'deleted',
        message: `Equipment "${equipmentToDelete.modelName}" has been permanently deleted.`,
      }
    }
  })

/**
 * Get equipment by ID for admin management (Admin only)
 * Returns equipment regardless of clearance level or active status
 */
export const getAdminEquipmentByIdFn = createServerFn({
  method: 'GET',
})
  .validator(z.object({ equipmentId: z.number() }))
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)
    const equipmentItem = await database
      .select({
        id: equipment.id,
        modelName: equipment.modelName,
        shortName: equipment.shortName,
        description: equipment.description,
        categoryId: equipment.categoryId,
        googleCalendarId: equipment.googleCalendarId,
        requiredClearanceLevel: equipment.requiredClearanceLevel,
        imagePath: equipment.imagePath,
        isActive: equipment.isActive,
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt,
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      })
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(eq(equipment.id, data.equipmentId))
      .limit(1)

    return equipmentItem[0] as EquipmentWithCategory | undefined
  })

/**
 * Get all equipment for admin management (Admin only)
 * Returns all equipment regardless of clearance level or active status
 */
export const getAdminEquipmentFn = createServerFn({
  method: 'GET',
})
  .validator(AdminEquipmentFiltersSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment, category } = await import('@/db/schema')
    const { eq, and, or, gte, lte, like, sql, asc, desc, inArray } =
      await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Normalize defaults since page/limit/sortBy/sortOrder are optional
    const page = data.page ?? 1
    const limit = data.limit ?? 50
    const sortBy = data.sortBy ?? 'modelName'
    const sortOrder = data.sortOrder ?? 'asc'

    // Build where conditions (no clearance level restriction for admins)
    const conditions = []

    // Add active status filter (optional for admins)
    if (data.isActive && data.isActive.length > 0) {
      conditions.push(inArray(equipment.isActive, data.isActive))
    }

    // Add category filter
    if (data.categoryIds && data.categoryIds.length > 0) {
      conditions.push(inArray(equipment.categoryId, data.categoryIds))
    }

    // Add search query filter
    if (data.searchQuery) {
      const searchTerm = `%${data.searchQuery}%`
      conditions.push(
        or(
          like(equipment.modelName, searchTerm),
          like(equipment.description, searchTerm),
          like(category.name, searchTerm)
        )!
      )
    }

    // Add clearance level range filters
    if (data.minClearanceLevel !== undefined) {
      conditions.push(
        gte(equipment.requiredClearanceLevel, data.minClearanceLevel)
      )
    }
    if (data.maxClearanceLevel !== undefined) {
      conditions.push(
        lte(equipment.requiredClearanceLevel, data.maxClearanceLevel)
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const offset = (page - 1) * limit

    // Get total count for pagination.
    // Only join category when the search query references category.name.
    const countQuery = data.searchQuery
      ? database
          .select({ count: sql<number>`count(*)` })
          .from(equipment)
          .leftJoin(category, eq(equipment.categoryId, category.id))
          .where(whereClause)
      : database
          .select({ count: sql<number>`count(*)` })
          .from(equipment)
          .where(whereClause)

    // Apply sorting
    const sortColumn = {
      modelName: equipment.modelName,
      category: category.name,
      requiredClearanceLevel: equipment.requiredClearanceLevel,
      isActive: equipment.isActive,
      createdAt: equipment.createdAt,
    }[sortBy]

    const orderBy = sortColumn
      ? sortOrder === 'desc'
        ? desc(sortColumn)
        : asc(sortColumn)
      : asc(equipment.modelName)

    // Get paginated equipment list
    const equipmentListQuery = database
      .select({
        id: equipment.id,
        modelName: equipment.modelName,
        description: equipment.description,
        categoryId: equipment.categoryId,
        googleCalendarId: equipment.googleCalendarId,
        requiredClearanceLevel: equipment.requiredClearanceLevel,
        imagePath: equipment.imagePath,
        isActive: equipment.isActive,
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt,
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      })
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    const [totalCountResult, equipmentList] = await Promise.all([
      countQuery,
      equipmentListQuery,
    ])

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / limit)

    const response: PaginatedEquipmentResponse = {
      data: equipmentList as EquipmentWithCategory[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }

    return response
  })

/**
 * Upload equipment image to Cloudflare R2 (Admin only)
 * Handles image upload and returns the path for storage
 */
export const uploadEquipmentImageFn = createServerFn({ method: 'POST' })
  .validator(UploadEquipmentImageSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(data.contentType)) {
      throw new Error(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      )
    }

    // Decode base64 image data
    const base64Data = data.imageData.split(',')[1] || data.imageData
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (imageBuffer.length > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.')
    }

    // Check if equipment exists
    const equipmentExists = await database
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.id, data.equipmentId))
      .get()

    if (!equipmentExists) {
      throw new Error('Equipment not found')
    }

    try {
      // Generate unique filename
      const fileExtension = data.contentType.split('/')[1]
      const fileName = `equipment-images/${data.equipmentId}-${Date.now()}.${fileExtension}`

      // Upload to Cloudflare R2
      const r2Response = await env.meriksirat_r2.put(fileName, imageBuffer, {
        httpMetadata: {
          contentType: data.contentType,
        },
      })

      if (!r2Response) {
        throw new Error('Failed to upload image to storage')
      }

      // Update equipment record with image path
      await database
        .update(equipment)
        .set({
          imagePath: fileName,
          updatedAt: new Date(),
        })
        .where(eq(equipment.id, data.equipmentId))

      return {
        success: true,
        imagePath: fileName,
        message: 'Image uploaded successfully',
      }
    } catch (error) {
      console.error('Image upload error:', error)
      throw new Error(
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })
