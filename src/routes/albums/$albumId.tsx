import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getUserFn } from '@/lib/user'
import {
  albumQueries,
  albumOgImageUrl,
  albumViewUrl,
  getShareOrigin,
} from '@/lib/albums'
import { AlbumPage } from '@/components/albums/$albumId'

const searchSchema = z.object({
  edit: z.string().optional(),
})

export const Route = createFileRoute('/albums/$albumId')({
  validateSearch: searchSchema,
  loader: async ({ context, params }) => {
    const albumKey = albumQueries.detail(params.albumId)
    const [user] = await Promise.all([
      getUserFn(),
      context.queryClient.ensureQueryData(albumKey),
    ])
    const album = context.queryClient.getQueryData(albumKey.queryKey)
    return { user, album }
  },
  head: ({ loaderData }) => {
    const album = loaderData?.album
    if (!album) return {}

    const title = album.title
    const description = (album.description || 'Photo album on NU Image').slice(
      0,
      300
    )
    const origin = getShareOrigin()
    const url = origin ? albumViewUrl(origin, album.id) : undefined
    const ogImage = album.coverFileId
      ? albumOgImageUrl(album.coverFileId)
      : undefined

    return {
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        ...(url ? [{ property: 'og:url', content: url }] : []),
        ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        ...(ogImage ? [{ name: 'twitter:image', content: ogImage }] : []),
      ],
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = Route.useLoaderData()
  const { albumId } = Route.useParams()
  const { edit } = Route.useSearch()

  return <AlbumPage albumId={albumId} edit={edit} authUser={user} />
}
