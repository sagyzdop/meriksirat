import { createFileRoute } from '@tanstack/react-router'
import { AlbumSearchSchema, albumQueries } from '@/lib/albums'
import { getUserFn } from '@/lib/user'
import { PublicAlbumsIndex } from '@/components/albums'

export const Route = createFileRoute('/albums/')({
  validateSearch: AlbumSearchSchema,
  // Skip React SSR but keep server-side loaders and head(): guest visitors
  // still get OG/meta tags in the HTML shell (link previews keep working),
  // while the photo grid renders client-side instead of burning Worker CPU.
  ssr: 'data-only',
  loaderDeps: ({ search }) => ({ filters: search }),
  loader: async ({ context, deps }) => {
    const user = await getUserFn()
    try {
      await context.queryClient.ensureInfiniteQueryData({
        ...albumQueries.public(deps.filters),
        revalidateIfStale: true,
      })
    } catch (error) {
      console.error('Failed to load public albums:', error)
    }
    return { user }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = Route.useLoaderData()
  return <PublicAlbumsIndex user={user} />
}
