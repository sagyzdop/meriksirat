import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  AlbumFilterSchema,
  albumQueries,
  albumsEmptyResponse,
} from '@/lib/albums'
import type { AlbumFilter } from '@/lib/albums'
import { AlbumsPage } from '@/components/albums/albums-page'

const searchSchema = z.object({
  filter: AlbumFilterSchema,
})

export const Route = createFileRoute('/_authenticated/albums/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ filter: search.filter }),
  loader: async ({ context, deps }) => {
    const queryClient = context.queryClient
    try {
      await queryClient.ensureQueryData(albumQueries.mine(deps.filter))
    } catch (error) {
      console.error('Failed to load albums:', error)
    }
  },
  component: AlbumsIndex,
})

function AlbumsIndex() {
  const navigate = useNavigate({ from: '/albums/' })
  const search = Route.useSearch()
  const queryClient = useQueryClient()

  const { data: mine } = useQuery(albumQueries.mine(search.filter))

  const handleFilterChange = (filter: AlbumFilter) => {
    navigate({ search: (prev) => ({ ...prev, filter }) })
  }

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: albumQueries.all })
    navigate({ search: { filter: 'all' } })
  }

  return (
    <AlbumsPage
      mode="mine"
      filter={search.filter}
      onFilterChange={handleFilterChange}
      mine={mine ?? albumsEmptyResponse()}
      manage={albumsEmptyResponse()}
      onCreated={handleCreated}
    />
  )
}
