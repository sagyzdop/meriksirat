import { env } from 'cloudflare:workers'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { and, asc, desc, eq, gte, inArray, like, lte, or } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { resolveSession } from '@/lib/auth/resolve-session'
import { db } from '@/db'
import { category, equipment, user } from '@/db/schema'
import { EQUIPMENT_MIN_CLEARANCE } from './types'
import type { EquipmentFilters } from './types'

export async function getUserClearanceLevel(userId: string): Promise<number> {
  const database = db(env.meriksirat_d1 as D1Database)
  const userData = await database
    .select({ clearanceLevel: user.clearanceLevel })
    .from(user)
    .where(eq(user.id, userId))
    .get()

  return userData?.clearanceLevel || 1
}

export async function requireEquipmentAccess() {
  const session = await resolveSession(getRequestHeaders())
  if (!session?.user) return null
  const clearance = await getUserClearanceLevel(session.user.id)
  if (clearance < EQUIPMENT_MIN_CLEARANCE) return null
  return { database: db(env.meriksirat_d1 as D1Database), clearance }
}

export const equipmentWithCategory = {
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
}

export function equipmentWhere(data: EquipmentFilters, leading: SQL[]) {
  const conditions = [...leading]

  if (data.categoryIds && data.categoryIds.length > 0) {
    conditions.push(inArray(equipment.categoryId, data.categoryIds))
  }

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

  return and(...conditions)
}

export function equipmentOrderBy(data: EquipmentFilters) {
  const sortColumn = {
    modelName: equipment.modelName,
    category: category.name,
    requiredClearanceLevel: equipment.requiredClearanceLevel,
    isActive: equipment.isActive,
    createdAt: equipment.createdAt,
  }[data.sortBy ?? 'modelName']
  return data.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)
}
