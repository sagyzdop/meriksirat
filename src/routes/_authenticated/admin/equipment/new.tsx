import { createFileRoute } from '@tanstack/react-router'
import { getCategoriesFn } from '@/lib/equipment'
import { Page } from '@/components/admin/equipment/new'

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
  return <Page categories={categories} />
}
