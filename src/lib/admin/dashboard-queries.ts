import { queryOptions } from '@tanstack/react-query'
import {
  getAdminDashboardAlertsFn,
  getAdminDashboardStatsFn,
} from './functions/dashboard-stats'
import {
  exportUsersFn,
  getAdminUserAlbumsFn,
  getViolationsFn,
} from './functions/dashboard-users'
import {
  broadcastTelegramMessageFn,
  exportAlbumsFn,
} from './functions/dashboard-exports'
import type {
  AdminAlbumExport,
  AdminDashboardRange,
  AdminDashboardStats,
  AdminUserAlbumsFilters,
  AdminUserExport,
  BroadcastMessage,
  BroadcastResult,
  DashboardAlert,
  ExportUsersFilters,
  PaginatedAdminUserAlbumsResponse,
  PaginatedViolationsResponse,
  ViolationsFilters,
} from './dashboard-types'
import { getClubCodeFn } from './functions/club-code'
import { getBufferUsageFn } from '@/lib/buffer/functions'
import type { BufferUsageOverview } from '@/lib/buffer/functions'
import { getPoolOverviewFn, type PoolOverview } from './functions/pool'
import { getSettingsFn, type SettingsData } from './functions/settings'

/**
 * Resolves an optional date range to concrete ISO strings. When a bound is
 * missing it falls back to "now" (end) and the first day of the current month
 * (start), mirroring the server-side default.
 */
export function effectiveDashboardRange(range: AdminDashboardRange = {}): {
  startDate: string
  endDate: string
} {
  const endDate = range.endDate ? new Date(range.endDate) : new Date()
  const startDate = range.startDate
    ? new Date(range.startDate)
    : new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() }
}

export const adminDashboardQueries = {
  all: ['admin-dashboard'] as const,
  stats: (range: AdminDashboardRange = {}) =>
    queryOptions({
      // The key must be built from the raw range inputs, not the computed
      // dates: `effectiveDashboardRange` falls back to `new Date()` for
      // missing bounds, which would produce a new millisecond-precision ISO
      // string on every render and cause an infinite refetch loop.
      queryKey: [
        ...adminDashboardQueries.all,
        'stats',
        range.startDate ?? 'default-start',
        range.endDate ?? 'default-end',
      ],
      staleTime: 60_000,
      queryFn: async (): Promise<AdminDashboardStats> =>
        getAdminDashboardStatsFn({ data: effectiveDashboardRange(range) }),
    }),
  alerts: () =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'alerts'],
      refetchInterval: 60_000,
      queryFn: async (): Promise<DashboardAlert[]> =>
        getAdminDashboardAlertsFn(),
    }),
  violations: (filters: ViolationsFilters) =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'violations', filters],
      queryFn: async (): Promise<PaginatedViolationsResponse> =>
        getViolationsFn({ data: filters }),
    }),
  settings: () =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'settings'],
      queryFn: async (): Promise<SettingsData> => getSettingsFn(),
    }),
  pool: () =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'pool'],
      queryFn: async (): Promise<PoolOverview> => getPoolOverviewFn(),
    }),
  buffer: () =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'buffer'],
      queryFn: async (): Promise<BufferUsageOverview | null> =>
        getBufferUsageFn(),
    }),
  clubCode: () =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'club-code'],
      queryFn: async (): Promise<string> => getClubCodeFn(),
    }),
  userAlbums: (filters: AdminUserAlbumsFilters) =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'user-albums', filters],
      queryFn: async (): Promise<PaginatedAdminUserAlbumsResponse> =>
        getAdminUserAlbumsFn({ data: filters }),
    }),
  userExport: (filters: ExportUsersFilters) =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'user-export', filters],
      staleTime: Infinity,
      queryFn: async (): Promise<AdminUserExport[]> =>
        exportUsersFn({ data: filters }),
    }),
  albumExport: () =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'album-export'],
      staleTime: Infinity,
      queryFn: async (): Promise<AdminAlbumExport[]> => exportAlbumsFn(),
    }),
}

export async function broadcastMessage(
  message: string,
  offset = 0,
  limit = 20
): Promise<BroadcastResult> {
  return broadcastTelegramMessageFn({
    data: { message, offset, limit } satisfies BroadcastMessage,
  })
}
