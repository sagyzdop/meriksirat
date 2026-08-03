import { z } from 'zod'

// User Profile Types
export interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  name: string | null;
  telegramChatId: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
  googleId: string | null;
  nuId: number | null;
  firstName: string | null;
  lastName: string | null;
  birthday: string | null;
  major: string | null;
  graduationYear: number | null;
  status: string | null;
  clearanceLevel: number | null;
  role: string | null;
  onboardingComplete: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string
  email: string
  role: 'user' | 'manager' | 'admin' | null
  clearanceLevel: number | null
  status:
  | 'Active'
  | 'Inactive'
  | 'On Probation'
  | 'Board'
  | 'Ex-Board'
  | 'Roommate'
  | 'Ex-Roommate'
  | 'Graduated'
  | null
  firstName: string | null
  lastName: string | null
  createdAt: Date
  updatedAt: Date
}

// Admin User Management Schemas
export const AdminUserFiltersSchema = z.object({
  role: z.array(z.enum(['user', 'manager', 'admin'])).optional(),
  status: z.array(z.enum([
    'Active',
    'Inactive',
    'On Probation',
    'Board',
    'Ex-Board',
    'Roommate',
    'Ex-Roommate',
    'Graduated',
  ])).optional(),
  clearanceLevel: z.array(z.coerce.number()).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum(['firstName', 'lastName', 'email', 'role', 'status', 'clearanceLevel', 'createdAt'])
    .default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type AdminUserFilters = z.infer<typeof AdminUserFiltersSchema>

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
export const BulkUpdateUserClearanceSchema = z.object({
  userIds: z.array(z.string()),
  clearanceLevel: z.number().min(1).max(10),
})

export const GetUserByIdSchema = z.object({
  userId: z.string(),
})

// User Profile Update Schema (for users updating their own profile)
export const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  instagramUsername: z.string().optional(),
  birthday: z.string().optional(),
  major: z.string().optional(),
  graduationYear: z.number().min(1900).max(2100).optional(),
  nuId: z.number().optional(),
  image: z.string().optional(),
})
