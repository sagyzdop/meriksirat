import { z } from 'zod'

export const UpcomingBirthdaysFiltersSchema = z.object({
  /** Inclusive ISO date (`YYYY-MM-DD`) window; both default to sensible values. */
  from: z.string().optional(),
  to: z.string().optional(),
})

export type UpcomingBirthdaysFilters = z.infer<
  typeof UpcomingBirthdaysFiltersSchema
>

export interface BirthdayUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  status: string
  /** The raw birthday string stored on the user. */
  birthday: string
  /** `MM-DD` for display and sorting. */
  monthDay: string
  /** The date the birthday falls on inside the requested window. */
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
