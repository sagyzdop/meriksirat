import { queryOptions } from '@tanstack/react-query'
import {
  broadcastTelegramMessageFn,
  exportUsersFn,
  getAdminDashboardAlertsFn,
  getAdminDashboardStatsFn,
  getAdminMostActiveUsersFn,
  getAdminUserAlbumsFn,
  getViolationsFn,
} from './functions/dashboard'
import type {
  AdminDashboardRange,
  AdminDashboardStats,
  AdminUserAlbumsFilters,
  AdminUserExport,
  BroadcastMessage,
  BroadcastResult,
  DashboardAlert,
  ExportUsersFilters,
  MostActiveUsersFilters,
  PaginatedAdminUserAlbumsResponse,
  PaginatedMostActiveUsersResponse,
  PaginatedViolationsResponse,
  ViolationsFilters,
} from './dashboard-types'

/**
 * Search params owned by the dashboard route. Each table on the page owns a
 * prefixed set so the URL keeps working while both tables are rendered.
 */
export interface DashboardSearchParams {
  startDate?: string
  endDate?: string
  activePage?: number
  activeLimit?: number
  activeSortBy?: 'albumCount' | 'firstName' | 'email' | 'createdAt'
  activeSortOrder?: 'asc' | 'desc'
  activeSearch?: string
  violationPage?: number
  violationLimit?: number
  violationSortBy?:
    | 'firstName'
    | 'email'
    | 'role'
    | 'status'
    | 'cancelledInStartWindowCount'
    | 'overdueCount'
  violationSortOrder?: 'asc' | 'desc'
  violationSearch?: string
  violationType?: ('auto-cancelled' | 'overdue')[]
}

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
  mostActive: (filters: MostActiveUsersFilters) =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'most-active', filters],
      queryFn: async (): Promise<PaginatedMostActiveUsersResponse> =>
        getAdminMostActiveUsersFn({ data: filters }),
    }),
  violations: (filters: ViolationsFilters) =>
    queryOptions({
      queryKey: [...adminDashboardQueries.all, 'violations', filters],
      queryFn: async (): Promise<PaginatedViolationsResponse> =>
        getViolationsFn({ data: filters }),
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
}

export async function broadcastMessage(
  message: string
): Promise<BroadcastResult> {
  return broadcastTelegramMessageFn({
    data: { message } satisfies BroadcastMessage,
  })
}
