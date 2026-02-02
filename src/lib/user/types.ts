import { z } from 'zod'

// Admin User Management Schemas
export const AdminUserFiltersSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']).optional(),
  status: z
    .enum([
      'Active',
      'Inactive',
      'On Probation',
      'Board',
      'Ex-Board',
      'Roommate',
      'Ex-Roommate',
      'Graduated',
    ])
    .optional(),
  clearanceLevel: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sortBy: z
    .enum(['name', 'email', 'role', 'status', 'clearanceLevel', 'createdAt'])
    .default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const UpdateUserAdminSchema = z.object({
  userId: z.string(),
  role: z.enum(['user', 'manager', 'admin']).optional(),
  clearanceLevel: z.number().min(1).optional(),
  status: z
    .enum([
      'Active',
      'Inactive',
      'On Probation',
      'Board',
      'Ex-Board',
      'Roommate',
      'Ex-Roommate',
      'Graduated',
    ])
    .optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export const GetUserByIdSchema = z.object({
  userId: z.string(),
})
