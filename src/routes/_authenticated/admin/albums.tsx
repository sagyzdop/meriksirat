import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { albumQueries, albumsEmptyResponse } from '@/lib/albums'
import { AlbumsPage } from '@/components/albums/albums-page'

export const Route = createFileRoute('/_authenticated/admin/albums')({
  loader: async ({ context }) => {
    const queryClient = context.queryClient
    try {
      await queryClient.ensureQueryData(albumQueries.manage())
    } catch (error) {
      console.error('Failed to load albums:', error)
    }
  },
  component: AdminAlbums,
})

function AdminAlbums() {
  const { data: manage } = useQuery(albumQueries.manage())

  return (
    <AlbumsPage
      mode="manage"
      filter="all"
      onFilterChange={() => {}}
      mine={albumsEmptyResponse()}
      manage={manage ?? albumsEmptyResponse()}
      onCreated={() => {}}
    />
  )
}
