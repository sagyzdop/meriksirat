import { queryOptions } from '@tanstack/react-query'
import { getAdminUsersFn } from './admin-functions'
import type { AdminUserFilters } from './types'

export const usersQueries = {
  all: ['users'] as const,
  lists: () => ['users', 'list'] as const,
  adminList: (filters: AdminUserFilters) =>
    queryOptions({
      queryKey: [...usersQueries.lists(), filters],
      queryFn: () => getAdminUsersFn({ data: filters }),
    }),
}
