import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/admin/violations'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { stringArrayParam } from '@/lib/search-params'
import type { ViolationsFilters } from '@/lib/admin/dashboard-types'

const searchSchema = z.object({
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

type ViolationsSearch = z.infer<typeof searchSchema>

function violationsFilters(search: ViolationsSearch): ViolationsFilters {
  return {
    violationType: search.violationType,
    search: search.violationSearch,
    page: search.violationPage,
    limit: search.violationLimit,
    sortBy: search.violationSortBy,
    sortOrder: search.violationSortOrder,
  }
}

export const Route = createFileRoute('/_authenticated/admin/violations')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        adminDashboardQueries.violations(violationsFilters(deps.search))
      )
    } catch (error) {
      console.error(
        '[Violations Route Loader] Failed to load violations:',
        error
      )
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const filters = violationsFilters(search)
  const { data, isFetching } = useQuery(
    adminDashboardQueries.violations(filters)
  )

  return (
    <Page
      users={data?.users ?? []}
      pagination={
        data?.pagination ?? {
          page: search.violationPage,
          limit: search.violationLimit,
          totalCount: 0,
          totalPages: 0,
        }
      }
      filters={filters}
      search={search}
      isLoading={isFetching}
    />
  )
}
