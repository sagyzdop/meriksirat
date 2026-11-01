import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/admin/flamekeepers'
import { flamekeeperQueries } from '@/lib/flamekeeper'

const searchSchema = z.object({
  search: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/admin/flamekeepers')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search: search.search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        flamekeeperQueries.adminList(deps.search ? { search: deps.search } : {})
      )
    } catch (error) {
      console.error('[Flamekeepers Route Loader] Failed to load:', error)
    }
  },
})

function RouteComponent() {
  const { search } = Route.useSearch()
  const { data, isFetching } = useQuery(
    flamekeeperQueries.adminList(search ? { search } : {})
  )
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      flamekeepers={data ?? []}
      search={search}
      isLoading={isRouterPending || isFetching}
    />
  )
}
