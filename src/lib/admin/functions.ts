import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { AdminStats } from './types'
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  DeleteCategorySchema,
  UpdateCategorySortOrderSchema,
} from './types'

/**
 * Get admin dashboard statistics
 * Provides overview data for the admin dashboard
 */
export const getAdminStatsFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<AdminStats> => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('./server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user, equipment, booking } = await import('@/db/schema')
    const { eq, count } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Get total users count
    const totalUsersResult = await database
      .select({ count: count() })
      .from(user)

    // Get total equipment count (active only)
    const totalEquipmentResult = await database
      .select({ count: count() })
      .from(equipment)
      .where(eq(equipment.isActive, true))

    // Get total bookings count
    const totalBookingsResult = await database
      .select({ count: count() })
      .from(booking)

    // Get active bookings count
    const activeBookingsResult = await database
      .select({ count: count() })
      .from(booking)
      .where(eq(booking.status, 'active'))

    // Get overdue bookings count
    const overdueBookingsResult = await database
      .select({ count: count() })
      .from(booking)
      .where(eq(booking.status, 'overdue'))

    return {
      totalUsers: totalUsersResult[0]?.count || 0,
      totalEquipment: totalEquipmentResult[0]?.count || 0,
      totalBookings: totalBookingsResult[0]?.count || 0,
      activeBookings: activeBookingsResult[0]?.count || 0,
      overdueBookings: overdueBookingsResult[0]?.count || 0,
    }
  })

/**
 * Create a new equipment category
 * Validates category name uniqueness and admin permissions
 */
export const createCategoryFn = createServerFn({ method: 'POST' })
  .validator(CreateCategorySchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('./server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if category name already exists
    const existingCategory = await database
      .select({ id: category.id })
      .from(category)
      .where(eq(category.name, data.name))
      .get()

    if (existingCategory) {
      throw new Error('Category name already exists')
    }

    const result = await database
      .insert(category)
      .values({
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder,
      })
      .returning({ id: category.id })

    return { categoryId: result[0]?.id }
  })

/**
 * Update an existing equipment category
 * Validates category name uniqueness and admin permissions
 */
export const updateCategoryFn = createServerFn({ method: 'POST' })
  .validator(UpdateCategorySchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('./server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if category exists
    const existingCategory = await database
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, data.categoryId))
      .get()

    if (!existingCategory) {
      throw new Error('Category not found')
    }

    // Check if new name conflicts with existing category (excluding current one)
    if (data.name) {
      const nameConflict = await database
        .select({ id: category.id })
        .from(category)
        .where(eq(category.name, data.name))
        .get()

      if (nameConflict && nameConflict.id !== data.categoryId) {
        throw new Error('Category name already exists')
      }
    }

    await database
      .update(category)
      .set({
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder,
      })
      .where(eq(category.id, data.categoryId))

    return { success: true }
  })

/**
 * Delete an equipment category
 * Reassigns associated equipment to "Uncategorized" category before deletion
 */
export const deleteCategoryFn = createServerFn({ method: 'POST' })
  .validator(DeleteCategorySchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('./server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { category, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Check if category exists
    const categoryToDelete = await database
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(eq(category.id, data.categoryId))
      .get()

    if (!categoryToDelete) {
      throw new Error('Category not found')
    }

    // Find or create "Uncategorized" category
    let uncategorizedCategory = await database
      .select({ id: category.id })
      .from(category)
      .where(eq(category.name, 'Uncategorized'))
      .get()

    if (!uncategorizedCategory) {
      const result = await database
        .insert(category)
        .values({
          name: 'Uncategorized',
          description: 'Default category for equipment without specific categories',
          sortOrder: 999,
        })
        .returning({ id: category.id })

      uncategorizedCategory = { id: result[0]?.id }
    }

    if (!uncategorizedCategory?.id) {
      throw new Error('Failed to create or find Uncategorized category')
    }

    // Reassign all equipment from the category to be deleted to "Uncategorized"
    await database
      .update(equipment)
      .set({ categoryId: uncategorizedCategory.id })
      .where(eq(equipment.categoryId, data.categoryId))

    // Delete the category
    await database
      .delete(category)
      .where(eq(category.id, data.categoryId))

    return { success: true }
  })

/**
 * Get all categories with equipment count
 * Used for category management interface
 */
export const getCategoriesWithCountFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('./server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { category, equipment } = await import('@/db/schema')
    const { eq, sql } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const categories = await database
      .select({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        equipmentCount: sql<number>`count(${equipment.id})`,
      })
      .from(category)
      .leftJoin(equipment, eq(category.id, equipment.categoryId))
      .groupBy(category.id)
      .orderBy(category.sortOrder, category.name)

    // Ensure sortOrder is never null by providing default value
    return categories.map(cat => ({
      ...cat,
      sortOrder: cat.sortOrder ?? 0
    }))
  })

/**
 * Update category sort order after drag-and-drop reordering
 * Updates multiple categories' sort order in a single transaction
 */
export const updateCategorySortOrderFn = createServerFn({ method: 'POST' })
  .validator(UpdateCategorySortOrderSchema)
  .handler(async ({ data }) => {
    // Import server-only code inside handler
    const { checkAdminPermission } = await import('./server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Update each category's sort order
    for (const update of data.categoryUpdates) {
      await database
        .update(category)
        .set({ sortOrder: update.sortOrder })
        .where(eq(category.id, update.id))
    }

    return { success: true }
  })
