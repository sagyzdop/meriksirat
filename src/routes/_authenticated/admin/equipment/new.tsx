import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { getCategoriesFn } from '@/lib/equipment'
import { Page } from '@/components/admin/equipment/new'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute('/_authenticated/admin/equipment/new')({
  component: RouteComponent,
  loader: async () => {
    try {
      const categories = await getCategoriesFn()
      return { categories: categories || [] }
    } catch (error) {
      console.error('Failed to load categories:', error)
      return { categories: [] }
    }
  },
})

function RouteComponent() {
  const { categories } = Route.useLoaderData()
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })
  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page categories={categories} />
    </div>
  )
}
