import { queryOptions } from '@tanstack/react-query'
import { getAdminFlamekeepersFn, getMyFlamekeeperFn } from './functions'

export const flamekeeperQueries = {
  all: ['flamekeepers'] as const,
  mine: () =>
    queryOptions({
      queryKey: ['flamekeepers', 'mine'] as const,
      queryFn: () => getMyFlamekeeperFn(),
    }),
  adminList: (filters: { search?: string }) =>
    queryOptions({
      queryKey: ['flamekeepers', 'admin', filters] as const,
      queryFn: () => getAdminFlamekeepersFn({ data: filters }),
    }),
}
