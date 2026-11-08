import { createFileRoute } from '@tanstack/react-router'
import { favoriteQueries } from '@/lib/favorites'
import { Page } from '@/components/favorites/albums'

export const Route = createFileRoute('/_authenticated/favorites/albums')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(favoriteQueries.heartedAlbums())
    } catch (error) {
      console.error('Failed to load favorite albums:', error)
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Page />
}
