import { queryOptions } from '@tanstack/react-query'
import { getAdminUsersFn } from './functions'
import type { AdminUserFilters } from './types'

export const usersQueries = {
  all: ['users'] as const,
  lists: () => ['users', 'list'] as const,
  adminList: (filters: AdminUserFilters) =>
    queryOptions({
      queryKey: [...usersQueries.lists(), filters],
      queryFn: async () =>
        (await getAdminUsersFn({ data: filters })) ?? {
          users: [],
          pagination: {
            page: filters.page,
            limit: filters.limit,
            totalCount: 0,
            totalPages: 0,
          },
        },
    }),
}
