import { queryOptions } from '@tanstack/react-query'
import { getAdminAlumniFn, getAdminUsersFn } from './functions'
import type { AdminAlumniFilters, AdminUserFilters } from './types'

export const usersQueries = {
  all: ['users'] as const,
  lists: () => ['users', 'list'] as const,
  adminList: (filters: AdminUserFilters) =>
    queryOptions({
      queryKey: [...usersQueries.lists(), filters],
      queryFn: () => getAdminUsersFn({ data: filters }),
    }),
  alumniList: (filters: AdminAlumniFilters) =>
    queryOptions({
      queryKey: [...usersQueries.all, 'alumni', filters] as const,
      queryFn: () => getAdminAlumniFn({ data: filters }),
    }),
}
