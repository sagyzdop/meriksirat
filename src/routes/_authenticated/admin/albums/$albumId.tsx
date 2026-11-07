import { createFileRoute } from '@tanstack/react-router'
import { albumQueries } from '@/lib/albums/queries'
import { Page } from '@/components/admin/albums/$albumId'

export const Route = createFileRoute('/_authenticated/admin/albums/$albumId')({
  loader: async ({ context, params }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          albumQueries.detail(params.albumId)
        ),
        context.queryClient.ensureQueryData(
          albumQueries.authors(params.albumId)
        ),
      ])
    } catch (error) {
      console.error('Failed to load album:', error)
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { albumId } = Route.useParams()
  return <Page albumId={albumId} />
}
