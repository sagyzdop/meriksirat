import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import { Page } from '@/components/leaderboard'

export const Route = createFileRoute('/leaderboard')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(flamekeeperQueries.leaderboard()),
  head: () => ({
    meta: [{ title: 'Flamekeepers | NU Image' }],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { data } = useSuspenseQuery(flamekeeperQueries.leaderboard())
  return <Page entries={data} />
}
