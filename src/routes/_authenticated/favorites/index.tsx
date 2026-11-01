import { createFileRoute } from '@tanstack/react-router'
import { favoriteQueries } from '@/lib/favorites'
import { Page } from '@/components/favorites'

export const Route = createFileRoute('/_authenticated/favorites/')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(favoriteQueries.mine())
    } catch (error) {
      console.error('Failed to load favorites:', error)
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Page />
}
