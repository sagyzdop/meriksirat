import { z } from 'zod'
import type { FlamekeeperState } from '@/lib/access/access-rules'

export const USER_STATUSES = [
  'Active',
  'Inactive',
  'On Probation',
  'Board',
  'Ex-Board',
  'Roommate',
  'Ex-Roommate',
  'Graduated',
] as const

// User Profile Types
export interface UserProfile {
  id: string
  email: string
  emailVerified: boolean
  image: string | null
  name: string | null
  telegramChatId: string | null
  telegramUsername: string | null
  instagramUsername: string | null
  googleId: string | null
  nuId: number | null
  firstName: string | null
  lastName: string | null
  birthday: string | null
  major: string | null
  graduationDate: string | null
  status: string | null
  clearanceLevel: number | null
  role: string | null
  isMember: boolean
  flamekeeperState?: FlamekeeperState | null
  onboardingComplete: boolean | null
  termsAcceptedAt?: Date | null
  flamekeeperInvitationDismissedAt?: Date | null
  isMaster?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  image: string | null
  role: 'user' | 'manager' | 'admin' | null
  clearanceLevel: number | null
  status: (typeof USER_STATUSES)[number] | null
  firstName: string | null
  lastName: string | null
  albumCount: number | null
  flamekeeperState?: FlamekeeperState | null
  createdAt: Date
  updatedAt: Date
}

// Admin User Management Schemas
export const AdminUserFiltersSchema = z.object({
  role: z.array(z.enum(['user', 'manager', 'admin'])).optional(),
  status: z.array(z.enum(USER_STATUSES)).optional(),
  clearanceLevel: z.array(z.coerce.number()).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum([
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'clearanceLevel',
      'albumCount',
      'createdAt',
    ])
    .default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type AdminUserFilters = z.infer<typeof AdminUserFiltersSchema>

export const AlumniSortKeys = [
  'firstName',
  'lastName',
  'email',
  'createdAt',
] as const

export const AdminAlumniFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z.enum(AlumniSortKeys).default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type AdminAlumniFilters = z.infer<typeof AdminAlumniFiltersSchema>

export interface AlumniRow {
  id: string
  email: string
  image: string | null
  firstName: string | null
  lastName: string | null
  isMember: boolean
  createdAt: Date
}

export const UpdateUserAdminSchema = z.object({
  userId: z.string(),
  role: z.enum(['user', 'manager', 'admin']).optional(),
  clearanceLevel: z.number().min(1).optional(),
  status: z.enum(USER_STATUSES).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})
export const BulkUpdateUserClearanceSchema = z.object({
  userIds: z.array(z.string()),
  clearanceLevel: z.number().min(1).max(10),
})

export const GetUserByIdSchema = z.object({
  userId: z.string(),
})

export const ResetUserViolationCountersSchema = z.object({
  userId: z.string(),
})

export const BanUserSchema = z.object({
  userId: z.string(),
  reason: z.string().trim().min(1, 'Give a reason for the ban').max(500),
})

export const UnbanUserSchema = z.object({
  userId: z.string(),
})

// User Profile Update Schema (for users updating their own profile)
export const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  instagramUsername: z.string().optional(),
  birthday: z.string().optional(),
  major: z.string().optional(),
  graduationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your graduation month')
    .optional(),
  nuId: z.number().optional(),
  image: z.string().optional(),
})
