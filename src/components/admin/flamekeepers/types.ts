export const FLAMEKEEPER_SORT_KEYS = [
  'name',
  'status',
  'pledgedBytes',
  'usedBytes',
  'graduationDate',
  'createdAt',
] as const

export const FLAMEKEEPER_STATUSES = [
  'Active',
  'Full',
  'Draining',
  'Lost',
  'Stopped',
  'Banned',
] as const

export type FlamekeeperStatus = (typeof FLAMEKEEPER_STATUSES)[number]

export type FlamekeeperSortKey = (typeof FLAMEKEEPER_SORT_KEYS)[number]

export interface FlamekeeperTableFilters {
  search?: string
  status?: string[]
  page: number
  limit: number
  sortBy: FlamekeeperSortKey
  sortOrder: 'asc' | 'desc'
}
