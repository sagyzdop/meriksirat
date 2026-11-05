// PROTOTYPE: three tweaks of the original stacked layout, switchable with
// ?variant=A|B|C. Only the winning layout survives into the real page.
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

export const FLAMEKEEPER_VARIANTS = ['A', 'B', 'C'] as const

export type FlamekeeperVariant = (typeof FLAMEKEEPER_VARIANTS)[number]

export interface FlamekeeperTableFilters {
  search?: string
  status?: string[]
  page: number
  limit: number
  sortBy: FlamekeeperSortKey
  sortOrder: 'asc' | 'desc'
  variant: FlamekeeperVariant
}
