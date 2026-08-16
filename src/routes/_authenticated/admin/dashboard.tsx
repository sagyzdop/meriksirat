import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { stringArrayParam } from '@/lib/search-params'
import { Page } from '@/components/admin/dashboard'
import {
  adminDashboardQueries,
  effectiveDashboardRange,
} from '@/lib/admin/dashboard-queries'
import type {
  MostActiveUsersFilters,
  PaginatedMostActiveUsersResponse,
  PaginatedViolationsResponse,
  ViolationsFilters,
} from '@/lib/admin/dashboard-types'

const searchSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  activePage: z.coerce.number().min(1).default(1),
  activeLimit: z.coerce.number().min(1).max(100).default(10),
  activeSortBy: z
    .enum(['albumCount', 'firstName', 'email', 'createdAt'])
    .default('albumCount'),
  activeSortOrder: z.enum(['asc', 'desc']).default('desc'),
  activeSearch: z.string().optional(),
  violationPage: z.coerce.number().min(1).default(1),
  violationLimit: z.coerce.number().min(1).max(100).default(10),
  violationSortBy: z
    .enum([
      'firstName',
      'email',
      'role',
      'status',
      'cancelledInStartWindowCount',
      'overdueCount',
    ])
    .default('cancelledInStartWindowCount'),
  violationSortOrder: z.enum(['asc', 'desc']).default('desc'),
  violationSearch: z.string().optional(),
  violationType: stringArrayParam(z.enum(['auto-cancelled', 'overdue'])),
})

type DashboardSearch = z.infer<typeof searchSchema>

function mostActiveFilters(search: DashboardSearch): MostActiveUsersFilters {
  // Always send an explicit range so the table agrees with the Overview stats:
  // when no custom range is in the URL this resolves to the current month.
  const range = effectiveDashboardRange({
    startDate: search.startDate,
    endDate: search.endDate,
  })
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    search: search.activeSearch,
    page: search.activePage,
    limit: search.activeLimit,
    sortBy: search.activeSortBy,
    sortOrder: search.activeSortOrder,
  }
}

function violationsFilters(search: DashboardSearch): ViolationsFilters {
  return {
    violationType: search.violationType,
    search: search.violationSearch,
    page: search.violationPage,
    limit: search.violationLimit,
    sortBy: search.violationSortBy,
    sortOrder: search.violationSortOrder,
  }
}

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          adminDashboardQueries.stats({
            startDate: deps.search.startDate,
            endDate: deps.search.endDate,
          })
        ),
        context.queryClient.ensureQueryData(adminDashboardQueries.alerts()),
        context.queryClient.ensureQueryData(
          adminDashboardQueries.mostActive(mostActiveFilters(deps.search))
        ),
        context.queryClient.ensureQueryData(
          adminDashboardQueries.violations(violationsFilters(deps.search))
        ),
      ])
    } catch (error) {
      console.error('[Dashboard Route Loader] Failed to load dashboard:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { adminUser } = Route.useRouteContext()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const { data: stats, isFetching } = useQuery(
    adminDashboardQueries.stats({
      startDate: search.startDate,
      endDate: search.endDate,
    })
  )
  const { data: alerts } = useQuery(adminDashboardQueries.alerts())
  const { data: mostActive } = useQuery(
    adminDashboardQueries.mostActive(mostActiveFilters(search))
  )
  const { data: violations } = useQuery(
    adminDashboardQueries.violations(violationsFilters(search))
  )

  const emptyMostActive: PaginatedMostActiveUsersResponse = {
    users: [],
    pagination: {
      page: search.activePage,
      limit: search.activeLimit,
      totalCount: 0,
      totalPages: 0,
    },
  }
  const emptyViolations: PaginatedViolationsResponse = {
    users: [],
    pagination: {
      page: search.violationPage,
      limit: search.violationLimit,
      totalCount: 0,
      totalPages: 0,
    },
  }

  return (
    <Page
      search={search}
      stats={stats}
      alerts={alerts ?? []}
      mostActive={mostActive ?? emptyMostActive}
      violations={violations ?? emptyViolations}
      isLoading={isRouterPending || isFetching}
      canBroadcast={adminUser?.role === 'admin'}
    />
  )
}
