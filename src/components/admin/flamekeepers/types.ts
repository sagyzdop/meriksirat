export const FLAMEKEEPER_SORT_KEYS = [
  'name',
  'status',
  'state',
  'pledgedBytes',
  'usedBytes',
  'graduationDate',
  'createdAt',
] as const

export type FlamekeeperSortKey = (typeof FLAMEKEEPER_SORT_KEYS)[number]

export interface FlamekeeperTableFilters {
  search?: string
  status?: string[]
  page: number
  limit: number
  sortBy: FlamekeeperSortKey
  sortOrder: 'asc' | 'desc'
}
