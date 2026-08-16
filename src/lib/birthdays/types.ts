import { z } from 'zod'

export const UpcomingBirthdaysFiltersSchema = z.object({
  /** Inclusive ISO date (`YYYY-MM-DD`) window; both default to sensible values. */
  from: z.string().optional(),
  to: z.string().optional(),
})

export type UpcomingBirthdaysFilters = z.infer<
  typeof UpcomingBirthdaysFiltersSchema
>

/**
 * Server-side list filters for the admin birthdays table, mirroring the
 * admin users table (search, filter, pagination, sorting).
 */
export const BirthdayListFiltersSchema = z.object({
  wantsCongratulation: z.array(z.boolean()).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum([
      'firstName',
      'lastName',
      'wantsCongratulation',
      'occurrence',
      'turningAge',
    ])
    .default('occurrence'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type BirthdayListFilters = z.infer<typeof BirthdayListFiltersSchema>

export interface BirthdayPagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export interface BirthdayListResult {
  birthdays: BirthdayUser[]
  pagination: BirthdayPagination
}

export interface BirthdayUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  image: string | null
  wantsCongratulation: boolean
  /** The raw birthday string stored on the user. */
  birthday: string
  /** `MM-DD` for display and sorting. */
  monthDay: string
  /** The date of the member's next birthday (wraps around year end). */
  occurrence: string
  /** Age the user turns on this occurrence, or null when the year is unknown. */
  turningAge: number | null
}

export interface BirthdaySyncResult {
  created: number
  updated: number
  deleted: number
  skipped: number
}
