import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page } from '@/components/profile'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import { CONNECT_ERROR_MESSAGES } from '@/lib/flamekeeper/rules'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

const searchSchema = z.object({
  flamekeeper: z.literal('connected').optional().catch(undefined),
  fk_error: z
    .enum(['denied', 'state', 'session', 'account', 'scope', 'token', 'master'])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(flamekeeperQueries.mine())
  },
})

function RouteComponent() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const { data: flamekeeper } = useQuery(flamekeeperQueries.mine())
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })
  return (
    <div className="relative flex-1 space-y-4">
      {isLoading && <LoadingOverlay />}
      <Page
        user={user}
        flamekeeper={flamekeeper ?? null}
        justConnected={search.flamekeeper === 'connected'}
        connectError={
          search.fk_error ? CONNECT_ERROR_MESSAGES[search.fk_error] : null
        }
      />
    </div>
  )
}
