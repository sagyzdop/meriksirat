import { z } from 'zod'
import type { PageInfo } from '@/lib/pagination'

/**
 * Minimum user clearance level required to access equipment booking. Users
 * below this level see the Equipment section in the sidebar as inactive.
 */
export const EQUIPMENT_MIN_CLEARANCE = 2

export interface EquipmentWithCategory {
  id: number
  modelName: string
  shortName: string | null
  description: string | null
  categoryId: number | null
  googleCalendarId: string
  requiredClearanceLevel: number | null
  imagePath: string | null
  isActive: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
  category: {
    id: number
    name: string
    description: string | null
    sortOrder: number | null
  } | null
}

export const EquipmentFiltersSchema = z.object({
  categoryIds: z.array(z.coerce.number()).optional(),
  searchQuery: z.string().optional(),
  minClearanceLevel: z.coerce.number().optional(),
  maxClearanceLevel: z.coerce.number().optional(),
  clearanceLevels: z.array(z.coerce.number()).optional(),
  isActive: z.array(z.boolean()).optional(),
  // Sorting
  sortBy: z
    .enum([
      'modelName',
      'category',
      'requiredClearanceLevel',
      'isActive',
      'createdAt',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export type EquipmentFilters = z.infer<typeof EquipmentFiltersSchema>

export const AdminEquipmentFiltersSchema = EquipmentFiltersSchema.extend({
  // Pagination
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
})

export type AdminEquipmentFilters = z.infer<typeof AdminEquipmentFiltersSchema>

export interface EquipmentResponse {
  data: EquipmentWithCategory[]
}

export interface PaginatedEquipmentResponse extends EquipmentResponse {
  pagination: PageInfo
}

// Admin equipment management schemas
export const CreateEquipmentSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  shortName: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? val : undefined)),
  description: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? val : undefined)),
  categoryId: z.number().min(1, 'Category is required'),
  googleCalendarId: z.string().min(1, 'Google Calendar ID is required'),
  requiredClearanceLevel: z.number().min(1).default(1),
  imagePath: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? val : undefined)),
})

export const UpdateEquipmentSchema = CreateEquipmentSchema.extend({
  equipmentId: z.number(),
  isActive: z.boolean().optional(),
})
  .partial()
  .extend({
    equipmentId: z.number(), // equipmentId is always required
  })

export const DeleteEquipmentSchema = z.object({
  equipmentId: z.number(),
})

export function parseEquipmentImageForm(data: unknown): {
  equipmentId: number
  file: Blob
} {
  if (!(data instanceof FormData)) throw new Error('Expected FormData')
  const equipmentId = z.coerce
    .number()
    .int()
    .positive()
    .parse(data.get('equipmentId'))
  const file = data.get('file')
  if (!(file instanceof Blob)) throw new Error('Expected an image file')
  return { equipmentId, file }
}

export const BulkUpdateEquipmentClearanceSchema = z.object({
  equipmentIds: z.array(z.number()),
  requiredClearanceLevel: z.number().min(1).max(10),
})

export const BulkUpdateEquipmentCategorySchema = z.object({
  equipmentIds: z.array(z.number()),
  categoryId: z.number().min(1),
})

export const BulkUpdateEquipmentStatusSchema = z.object({
  equipmentIds: z.array(z.number()),
  isActive: z.boolean(),
})

export const BulkDeleteEquipmentSchema = z.object({
  equipmentIds: z.array(z.number()).min(1),
})
