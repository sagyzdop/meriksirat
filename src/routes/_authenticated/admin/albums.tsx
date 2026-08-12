import { createFileRoute } from '@tanstack/react-router'
import { AlbumListFiltersSchema, albumQueries } from '@/lib/albums'
import { AdminAlbums } from '@/components/albums/admin'

export const Route = createFileRoute('/_authenticated/admin/albums')({
  validateSearch: AlbumListFiltersSchema,
  loaderDeps: ({ search }) => ({ filters: search }),
  loader: async ({ context, deps }) => {
    const queryClient = context.queryClient
    try {
      await queryClient.ensureInfiniteQueryData({
        ...albumQueries.manage(deps.filters),
        revalidateIfStale: true,
      })
    } catch (error) {
      console.error('Failed to load albums:', error)
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  return <AdminAlbums search={search} />
}
