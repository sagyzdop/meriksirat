import {
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { stringArrayParam } from '@/lib/search-params'
import { Page } from '@/components/admin/dashboard'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import {
  adminDashboardQueries,
  DASHBOARD_TABS,
  type DashboardTab,
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
  tab: z.enum(DASHBOARD_TABS).default('overview'),
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
  // Pass the raw search dates. The server resolves missing bounds to the
  // current month (same default as the Overview stats), and the query key must
  // stay value-stable: resolving to millisecond-precision ISO strings here
  // would change the key on every render and refetch endlessly.
  return {
    startDate: search.startDate,
    endDate: search.endDate,
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
  pendingComponent: DashboardPending,
  validateSearch: searchSchema,
  // Only depend on the values the loader reads. Tab switches and table
  // pagination must reuse the existing match instead of re-running the
  // loader — otherwise every tab click drops the page into a pending state.
  loaderDeps: ({ search }) => ({
    startDate: search.startDate,
    endDate: search.endDate,
  }),
  loader: async ({ deps, context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          adminDashboardQueries.stats({
            startDate: deps.startDate,
            endDate: deps.endDate,
          })
        ),
        context.queryClient.ensureQueryData(adminDashboardQueries.alerts()),
      ])
    } catch (error) {
      console.error('[Dashboard Route Loader] Failed to load dashboard:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { adminUser } = Route.useRouteContext()
  const navigate = useNavigate()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  const { data: stats, isFetching: isStatsFetching } = useQuery(
    adminDashboardQueries.stats({
      startDate: search.startDate,
      endDate: search.endDate,
    })
  )
  const { data: alerts, isFetching: isAlertsFetching } = useQuery(
    adminDashboardQueries.alerts()
  )
  // Non-default tabs fetch lazily: disabled until their tab is active, then
  // standard `enabled` fetch on first activation.
  const { data: mostActive, isFetching: isMostActiveFetching } = useQuery({
    ...adminDashboardQueries.mostActive(mostActiveFilters(search)),
    enabled: search.tab === 'albums',
  })
  const { data: violations, isFetching: isViolationsFetching } = useQuery({
    ...adminDashboardQueries.violations(violationsFilters(search)),
    enabled: search.tab === 'violations',
  })
  const { data: settings, isFetching: isSettingsFetching } = useQuery({
    ...adminDashboardQueries.settings(),
    enabled: search.tab === 'settings',
  })

  const handleTabChange = (tab: DashboardTab) => {
    navigate({ to: '.', search: { ...search, tab } as never })
  }

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
      tab={search.tab}
      onTabChange={handleTabChange}
      stats={stats}
      statsLoading={isRouterPending || (isStatsFetching && !stats)}
      alerts={alerts ?? []}
      alertsLoading={isRouterPending || (isAlertsFetching && !alerts)}
      mostActive={mostActive ?? emptyMostActive}
      mostActiveLoading={
        isRouterPending || (isMostActiveFetching && !mostActive)
      }
      violations={violations ?? emptyViolations}
      violationsLoading={
        isRouterPending || (isViolationsFetching && !violations)
      }
      settings={settings}
      settingsLoading={isRouterPending || (isSettingsFetching && !settings)}
      canBroadcast={adminUser?.role === 'admin'}
    />
  )
}

function DashboardPending() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Monitor bookings, album storage, user activity, and club health"
      />
      <div className="space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-9 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </PageContainer>
  )
}
