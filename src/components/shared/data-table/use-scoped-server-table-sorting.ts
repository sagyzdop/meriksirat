import * as React from 'react'
import type { SortingState } from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'

export interface ScopedSorting {
  /** URL search-param prefix owning this table, e.g. `active` → `activeSortBy`. */
  prefix: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

/**
 * Server-driven sorting for routes that host multiple tables. Each table owns
 * a prefixed set of search params (`activeSortBy`, `activeSortOrder`, ...) so
 * sorting one table never clobbers the other's params.
 */
export function useScopedServerTableSorting<TSearch extends object>(
  search: TSearch,
  sorting: ScopedSorting
) {
  const navigate = useNavigate()

  const [sortingState, setSortingState] = React.useState<SortingState>([
    { id: sorting.sortBy, desc: sorting.sortOrder === 'desc' },
  ])

  React.useEffect(() => {
    setSortingState([
      { id: sorting.sortBy, desc: sorting.sortOrder === 'desc' },
    ])
  }, [sorting.sortBy, sorting.sortOrder])

  const handleSortingChange = React.useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      const currentSorting: SortingState = [
        { id: sorting.sortBy, desc: sorting.sortOrder === 'desc' },
      ]

      const newSorting =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(currentSorting)
          : updaterOrValue

      if (newSorting.length > 0) {
        const sort = newSorting[0]
        navigate({
          to: '.',
          search: {
            ...search,
            [`${sorting.prefix}SortBy`]: sort.id,
            [`${sorting.prefix}SortOrder`]: sort.desc ? 'desc' : 'asc',
            [`${sorting.prefix}Page`]: 1,
          } as never,
        })
      }
    },
    [search, sorting, navigate]
  )

  return { sorting: sortingState, handleSortingChange }
}
