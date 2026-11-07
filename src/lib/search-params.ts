import { z } from 'zod'

/**
 * Search-param helpers for TanStack Router `validateSearch` schemas.
 *
 * URL search params arrive as strings (or arrays of strings when repeated),
 * so array params need a `preprocess` step to coerce them. These helpers
 * replace the repeated inline preprocess blocks in the route files.
 *
 * Accepted shapes for an array param `?tag=a&tag=b` or `?tag=a,b` or `?tag=["a","b"]`:
 * - a single string: `["a"]`
 * - a comma-separated string: `["a", "b"]`
 * - a stringified JSON array: `["a", "b"]`
 * - an actual array (already parsed by the router)
 * - `undefined` / empty string: `undefined`
 */
function toArrayParam(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    if (value === '') return undefined
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // Fall through to the other string treatments.
      }
    }
    if (value.includes(',')) return value.split(',')
    return [value]
  }
  if (value === undefined || value === null) return undefined
  return [value]
}

/** Optional array of strings, e.g. `?status=booked,cancelled`. */
export function stringArrayParam<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .preprocess((val) => toArrayParam(val), z.array(itemSchema))
    .optional()
}

/** Optional array of numbers, e.g. `?categoryIds=1,2,3`. */
export function numberArrayParam() {
  return z
    .preprocess((val) => {
      const arr = toArrayParam(val)
      return arr === undefined ? undefined : arr.map(Number)
    }, z.array(z.coerce.number()))
    .optional()
}

/** Optional array of booleans, e.g. `?isActive=true`. */
export function booleanArrayParam() {
  return z
    .preprocess((val) => {
      const arr = toArrayParam(val)
      return arr === undefined
        ? undefined
        : arr.map((v) => String(v) === 'true')
    }, z.array(z.boolean()))
    .optional()
}

const dateOnlyParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

export const ADMIN_ALBUM_SORT_FIELDS = [
  'title',
  'eventDate',
  'createdAt',
  'photoCount',
  'photoBytes',
] as const

export const AdminAlbumFiltersShape = {
  search: z.string().optional(),
  status: stringArrayParam(z.enum(['rescued', 'scheduled_deletion'])),
  storage: stringArrayParam(z.enum(['buffer', 'flamekeeper'])),
  startDate: dateOnlyParam,
  endDate: dateOnlyParam,
}

export const AdminAlbumSearchSchema = z.object({
  ...AdminAlbumFiltersShape,
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.enum(ADMIN_ALBUM_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
