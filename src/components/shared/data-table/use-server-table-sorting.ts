import * as React from 'react'
import type { SortingState } from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'

export interface UrlSortingFilters {
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

/**
 * Keeps TanStack Table sorting state in sync with URL search params
 * and navigates (server-driven sorting) when the user changes sorting.
 */
export function useServerTableSorting(filters: UrlSortingFilters) {
  const navigate = useNavigate()

  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc',
    },
  ])

  React.useEffect(() => {
    setSorting([
      {
        id: filters.sortBy,
        desc: filters.sortOrder === 'desc',
      },
    ])
  }, [filters.sortBy, filters.sortOrder])

  const handleSortingChange = React.useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      const currentSorting: SortingState = [
        {
          id: filters.sortBy,
          desc: filters.sortOrder === 'desc',
        },
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
            ...filters,
            sortBy: sort.id as never,
            sortOrder: sort.desc ? 'desc' : 'asc',
            page: 1,
          } as never,
        })
      }
    },
    [filters, navigate]
  )

  return { sorting, handleSortingChange }
}
