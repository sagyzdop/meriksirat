import { z } from 'zod'
import { stringArrayParam } from '@/lib/search-params'

// ---------------------------------------------------------------------------
// Dashboard data range
// ---------------------------------------------------------------------------

/**
 * Global date range for the dashboard. When omitted the server falls back to
 * the last 6 months.
 */
export const AdminDashboardRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})
export type AdminDashboardRange = z.infer<typeof AdminDashboardRangeSchema>

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------

export interface BookingStats {
  total: number
  booked: number
  active: number
  overdue: number
  returned: number
  cancelled: number
  partially_returned: number
}

export interface AlbumsPerMonthPoint {
  /** `YYYY-MM` key. */
  month: string
  public: number
  private: number
}

export interface AlbumStorageStats {
  albumCount: number
  photoCount: number
  totalBytes: number
}

export interface AdminDashboardStats {
  albumsPerMonth: AlbumsPerMonthPoint[]
  bookingStats: BookingStats
  albumStorage: AlbumStorageStats
}

// ---------------------------------------------------------------------------
// Dashboard alerts
// ---------------------------------------------------------------------------

export type DashboardAlertSeverity = 'info' | 'warning' | 'danger'

export interface DashboardAlert {
  id: string
  severity: DashboardAlertSeverity
  title: string
  message: string
  /** Optional admin route the alert links to. */
  href?: string
}

// ---------------------------------------------------------------------------
// Most active users
// ---------------------------------------------------------------------------

export const MostActiveUsersFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z
    .enum(['albumCount', 'firstName', 'email', 'createdAt'])
    .optional()
    .default('albumCount'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
export type MostActiveUsersFilters = z.infer<
  typeof MostActiveUsersFiltersSchema
>

export interface MostActiveUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  albumCount: number
}

export interface PaginatedMostActiveUsersResponse {
  users: MostActiveUser[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------

export const ViolationTypeSchema = z.enum(['auto-cancelled', 'overdue'])
export type ViolationType = z.infer<typeof ViolationTypeSchema>

export const ViolationsFiltersSchema = z.object({
  violationType: z.array(ViolationTypeSchema).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z
    .enum([
      'firstName',
      'email',
      'role',
      'status',
      'cancelledInStartWindowCount',
      'overdueCount',
    ])
    .optional()
    .default('cancelledInStartWindowCount'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
export type ViolationsFilters = z.infer<typeof ViolationsFiltersSchema>

export interface ViolationRow {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  role: string | null
  status: string | null
  cancelledInStartWindowCount: number
  overdueCount: number
  violationTypes: ViolationType[]
}

export interface PaginatedViolationsResponse {
  users: ViolationRow[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

// ---------------------------------------------------------------------------
// User albums (admin user detail)
// ---------------------------------------------------------------------------

export const AdminUserAlbumsFiltersSchema = z.object({
  userId: z.string(),
  search: z.string().optional(),
  visibility: stringArrayParam(z.enum(['public', 'private'])),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z
    .enum(['title', 'isShared', 'createdAt', 'coAuthorCount'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})
export type AdminUserAlbumsFilters = z.infer<
  typeof AdminUserAlbumsFiltersSchema
>

export interface AdminUserAlbum {
  id: string
  title: string
  isShared: boolean
  createdAt: string
  coAuthorCount: number
}

export interface PaginatedAdminUserAlbumsResponse {
  albums: AdminUserAlbum[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

// ---------------------------------------------------------------------------
// User export
// ---------------------------------------------------------------------------

/**
 * Filter subset used for the full-set user export. No pagination: every user
 * matching the current filters is returned.
 */
export const ExportUsersFiltersSchema = z.object({
  role: z.array(z.enum(['user', 'manager', 'admin'])).optional(),
  status: z
    .array(
      z.enum([
        'Active',
        'Inactive',
        'On Probation',
        'Board',
        'Ex-Board',
        'Roommate',
        'Ex-Roommate',
        'Graduated',
      ])
    )
    .optional(),
  clearanceLevel: z.array(z.coerce.number()).optional(),
  search: z.string().optional(),
})
export type ExportUsersFilters = z.infer<typeof ExportUsersFiltersSchema>

export interface AdminUserExport {
  id: string
  name: string
  email: string
  role: string | null
  status: string | null
  clearanceLevel: number | null
  firstName: string | null
  lastName: string | null
  instagramUsername: string | null
  nuId: number | null
  telegramUsername: string | null
  telegramChatId: string | null
  major: string | null
  graduationYear: number | null
  onboardingComplete: boolean
  cancelledInStartWindowCount: number
  overdueCount: number
  createdAt: Date | string
  updatedAt: Date | string
}

// ---------------------------------------------------------------------------
// Telegram broadcast
// ---------------------------------------------------------------------------

export const BroadcastMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(4000, 'Message must be at most 4000 characters'),
})
export type BroadcastMessage = z.infer<typeof BroadcastMessageSchema>

export interface BroadcastResult {
  total: number
  linked: number
  sent: number
  failed: number
  /** Users without a linked Telegram chat (never eligible for delivery). */
  skipped: number
}
