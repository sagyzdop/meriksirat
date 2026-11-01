import { queryOptions } from '@tanstack/react-query'
import {
  getAdminFlamekeepersFn,
  getLeaderboardFn,
  getMyFlamekeeperFn,
} from './functions'

export const flamekeeperQueries = {
  all: ['flamekeepers'] as const,
  mine: () =>
    queryOptions({
      queryKey: ['flamekeepers', 'mine'] as const,
      queryFn: () => getMyFlamekeeperFn(),
    }),
  leaderboard: () =>
    queryOptions({
      queryKey: ['flamekeepers', 'leaderboard'] as const,
      queryFn: () => getLeaderboardFn(),
    }),
  adminList: (filters: { search?: string }) =>
    queryOptions({
      queryKey: ['flamekeepers', 'admin', filters] as const,
      queryFn: () => getAdminFlamekeepersFn({ data: filters }),
    }),
}
