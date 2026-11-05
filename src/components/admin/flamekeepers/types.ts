import { USER_STATUSES } from '@/lib/user/types'

export const FLAMEKEEPER_SORT_KEYS = [
  'name',
  'usedBytes',
  'graduationDate',
  'createdAt',
] as const

export type FlamekeeperSortKey = (typeof FLAMEKEEPER_SORT_KEYS)[number]

export const FLAMEKEEPER_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Recently added' },
  { value: 'name:asc', label: 'Name' },
  { value: 'usedBytes:desc', label: 'Most used' },
  { value: 'graduationDate:asc', label: 'Graduation' },
] as const

export interface FlamekeeperFilters {
  search?: string
  status?: (typeof USER_STATUSES)[number]
  attention?: '1'
  sortBy: FlamekeeperSortKey
  sortOrder: 'asc' | 'desc'
}
