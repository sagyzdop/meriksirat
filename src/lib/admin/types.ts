import { z } from 'zod'

// Admin user interface
export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'user' | 'manager' | 'admin'
  clearanceLevel: number
  status: string
  firstName: string | null
  lastName: string | null
  createdAt: Date
  updatedAt: Date
}

// Admin dashboard statistics
export interface AdminStats {
  totalUsers: number
  totalEquipment: number
  totalBookings: number
  activeBookings: number
  overdueBookings: number
}

// Category management schemas
export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  sortOrder: z.number().default(0),
})

export const UpdateCategorySchema = CreateCategorySchema.extend({
  categoryId: z.number(),
})

export const DeleteCategorySchema = z.object({
  categoryId: z.number()
})

export const UpdateCategorySortOrderSchema = z.object({
  categoryUpdates: z.array(z.object({
    id: z.number(),
    sortOrder: z.number()
  }))
})

export const CategorySortSchema = z.object({
  sortBy: z.enum(['name', 'sortOrder', 'equipmentCount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})
