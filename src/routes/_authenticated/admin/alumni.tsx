import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/admin/alumni'
import { usersQueries, AlumniSortKeys } from '@/lib/user'

const searchSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z.enum(AlumniSortKeys).default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const Route = createFileRoute('/_authenticated/admin/alumni')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        usersQueries.alumniList(deps.search)
      )
    } catch (error) {
      console.error('[Alumni Route Loader] Failed to load alumni:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { data, isFetching } = useQuery(usersQueries.alumniList(search))
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      users={data?.users ?? []}
      pagination={
        data?.pagination ?? {
          page: 1,
          limit: search.limit,
          totalCount: 0,
          totalPages: 0,
        }
      }
      filters={search}
      isLoading={isRouterPending || isFetching}
    />
  )
}
