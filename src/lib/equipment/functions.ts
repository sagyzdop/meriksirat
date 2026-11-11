import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  PaginatedEquipmentResponse,
  EquipmentResponse,
  EquipmentWithCategory,
} from './types'
import {
  EquipmentFiltersSchema,
  AdminEquipmentFiltersSchema,
  CreateEquipmentSchema,
  UpdateEquipmentSchema,
  DeleteEquipmentSchema,
  parseEquipmentImageForm,
  BulkUpdateEquipmentClearanceSchema,
  BulkUpdateEquipmentCategorySchema,
  BulkUpdateEquipmentStatusSchema,
  BulkDeleteEquipmentSchema,
} from './types'
import { buildPageInfo } from '@/lib/pagination'
import { UserError, isUserError } from '@/lib/user-error'

export const getEquipmentFn = createServerFn({
  method: 'GET',
})
  .validator(EquipmentFiltersSchema)
  .handler(async ({ data }) => {
    const {
      requireEquipmentAccess,
      equipmentWithCategory,
      equipmentWhere,
      equipmentOrderBy,
    } = await import('./server')
    const { equipment, category } = await import('@/db/schema')
    const { eq, lte, inArray } = await import('drizzle-orm')

    const access = await requireEquipmentAccess()
    if (!access) return null
    const { database, clearance } = access

    const equipmentList = await database
      .select(equipmentWithCategory)
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(
        equipmentWhere(data, [
          lte(equipment.requiredClearanceLevel, clearance),
          data.isActive && data.isActive.length > 0
            ? inArray(equipment.isActive, data.isActive)
            : eq(equipment.isActive, true),
        ])
      )
      .orderBy(equipmentOrderBy(data))

    const response: EquipmentResponse = { data: equipmentList }

    return response
  })

export const getEquipmentByIdFn = createServerFn({
  method: 'GET',
})
  .validator(z.object({ equipmentId: z.coerce.number() }))
  .handler(async ({ data }) => {
    const { requireEquipmentAccess, equipmentWithCategory } =
      await import('./server')
    const { equipment, category } = await import('@/db/schema')
    const { eq, and, lte } = await import('drizzle-orm')

    const access = await requireEquipmentAccess()
    if (!access) return null
    const { database, clearance } = access

    const equipmentItem = await database
      .select(equipmentWithCategory)
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(
        and(
          eq(equipment.id, data.equipmentId),
          eq(equipment.isActive, true),
          lte(equipment.requiredClearanceLevel, clearance)
        )
      )
      .limit(1)

    return equipmentItem[0] as EquipmentWithCategory | undefined
  })

export const getCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireEquipmentAccess } = await import('./server')
    const { category } = await import('@/db/schema')

    const access = await requireEquipmentAccess()
    if (!access) return null

    return access.database
      .select()
      .from(category)
      .orderBy(category.sortOrder, category.name)
  }
)

export const createEquipmentFn = createServerFn({ method: 'POST' })
  .validator(CreateEquipmentSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment, category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const existingEquipment = await database
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.googleCalendarId, data.googleCalendarId))
      .get()

    if (existingEquipment) {
      throw new UserError(
        'Google Calendar ID already exists. Each equipment must have a unique calendar.'
      )
    }

    const categoryExists = await database
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, data.categoryId))
      .get()

    if (!categoryExists) {
      throw new UserError('Selected category does not exist')
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

export const updateEquipmentFn = createServerFn({ method: 'POST' })
  .validator(UpdateEquipmentSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment, category } = await import('@/db/schema')
    const { eq, and, ne } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const existingEquipment = await database
      .select({
        id: equipment.id,
        googleCalendarId: equipment.googleCalendarId,
      })
      .from(equipment)
      .where(eq(equipment.id, data.equipmentId))
      .get()

    if (!existingEquipment) {
      throw new UserError('Equipment not found')
    }

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
        throw new UserError(
          'Google Calendar ID already exists. Each equipment must have a unique calendar.'
        )
      }
    }

    if (data.categoryId) {
      const categoryExists = await database
        .select({ id: category.id })
        .from(category)
        .where(eq(category.id, data.categoryId))
        .get()

      if (!categoryExists) {
        throw new UserError('Selected category does not exist')
      }
    }

    const { equipmentId, ...fields } = data
    await database
      .update(equipment)
      .set(fields)
      .where(eq(equipment.id, equipmentId))

    return { success: true }
  })

export const bulkUpdateEquipmentClearanceFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateEquipmentClearanceSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    if (data.equipmentIds.length === 0) {
      throw new UserError('No equipment IDs provided')
    }

    await database
      .update(equipment)
      .set({ requiredClearanceLevel: data.requiredClearanceLevel })
      .where(inArray(equipment.id, data.equipmentIds))

    return { success: true, count: data.equipmentIds.length }
  })

export const bulkUpdateEquipmentCategoryFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateEquipmentCategorySchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment, category } = await import('@/db/schema')
    const { eq, inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    if (data.equipmentIds.length === 0) {
      throw new UserError('No equipment IDs provided')
    }

    const categoryExists = await database
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, data.categoryId))
      .get()

    if (!categoryExists) {
      throw new UserError('Selected category does not exist')
    }

    await database
      .update(equipment)
      .set({ categoryId: data.categoryId })
      .where(inArray(equipment.id, data.equipmentIds))

    return { success: true, count: data.equipmentIds.length }
  })

export const bulkUpdateEquipmentStatusFn = createServerFn({ method: 'POST' })
  .validator(BulkUpdateEquipmentStatusSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    if (data.equipmentIds.length === 0) {
      throw new UserError('No equipment IDs provided')
    }

    await database
      .update(equipment)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(inArray(equipment.id, data.equipmentIds))

    return { success: true, count: data.equipmentIds.length }
  })

export const bulkDeleteEquipmentFn = createServerFn({ method: 'POST' })
  .validator(BulkDeleteEquipmentSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment, bookingItem } = await import('@/db/schema')
    const { inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const withBookings = await database
      .selectDistinct({ equipmentId: bookingItem.equipmentId })
      .from(bookingItem)
      .where(inArray(bookingItem.equipmentId, data.equipmentIds))

    const blocked = new Set(withBookings.map((row) => row.equipmentId))
    const deletable = data.equipmentIds.filter((id) => !blocked.has(id))

    for (let i = 0; i < deletable.length; i += 50) {
      await database
        .delete(equipment)
        .where(inArray(equipment.id, deletable.slice(i, i + 50)))
    }

    return {
      deleted: deletable.length,
      skipped: data.equipmentIds.length - deletable.length,
    }
  })

export const deleteEquipmentFn = createServerFn({ method: 'POST' })
  .validator(DeleteEquipmentSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipment, booking, bookingItem } = await import('@/db/schema')
    const { eq, and, or, sql } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

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
      throw new UserError('Equipment not found')
    }

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
      await database.delete(equipment).where(eq(equipment.id, data.equipmentId))

      return {
        success: true,
        action: 'deleted',
        message: `Equipment "${equipmentToDelete.modelName}" has been permanently deleted.`,
      }
    }
  })

export const getAdminEquipmentByIdFn = createServerFn({
  method: 'GET',
})
  .validator(z.object({ equipmentId: z.number() }))
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipmentWithCategory } = await import('./server')
    const { equipment, category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const equipmentItem = await database
      .select(equipmentWithCategory)
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(eq(equipment.id, data.equipmentId))
      .limit(1)

    return equipmentItem[0] as EquipmentWithCategory | undefined
  })

export const getAdminEquipmentFn = createServerFn({
  method: 'GET',
})
  .validator(AdminEquipmentFiltersSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { equipmentWithCategory, equipmentWhere, equipmentOrderBy } =
      await import('./server')
    const { equipment, category } = await import('@/db/schema')
    const { eq, sql, inArray } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const page = data.page ?? 1
    const limit = data.limit ?? 50

    const whereClause = equipmentWhere(
      data,
      data.isActive && data.isActive.length > 0
        ? [inArray(equipment.isActive, data.isActive)]
        : []
    )

    const offset = (page - 1) * limit

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

    const equipmentListQuery = database
      .select(equipmentWithCategory)
      .from(equipment)
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(whereClause)
      .orderBy(equipmentOrderBy(data))
      .limit(limit)
      .offset(offset)

    const [totalCountResult, equipmentList] = await Promise.all([
      countQuery,
      equipmentListQuery,
    ])

    const total = totalCountResult[0]?.count || 0

    const response: PaginatedEquipmentResponse = {
      data: equipmentList,
      pagination: buildPageInfo(total, page, limit),
    }

    return response
  })

export const uploadEquipmentImageFn = createServerFn({ method: 'POST' })
  .validator(parseEquipmentImageForm)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const { database } = await adminContext(['admin', 'manager'])

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(data.file.type)) {
      throw new UserError(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      )
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (data.file.size > maxSize) {
      throw new UserError('File size too large. Maximum size is 5MB.')
    }

    const equipmentExists = await database
      .select({ id: equipment.id })
      .from(equipment)
      .where(eq(equipment.id, data.equipmentId))
      .get()

    if (!equipmentExists) {
      throw new UserError('Equipment not found')
    }

    try {
      const fileExtension = data.file.type.split('/')[1]
      const fileName = `equipment-images/${data.equipmentId}-${Date.now()}.${fileExtension}`

      const r2Response = await env.meriksirat_r2.put(
        fileName,
        await data.file.arrayBuffer(),
        { httpMetadata: { contentType: data.file.type } }
      )

      if (!r2Response) {
        throw new Error('Failed to upload image to storage')
      }

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
      throw isUserError(error) ? error : new UserError('Failed to upload image')
    }
  })
