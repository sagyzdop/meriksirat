import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/categories/index'
import { getCategoriesWithCountFn } from '@/lib/admin'

export const Route = createFileRoute('/_authenticated/admin/categories/')({
  component: RouteComponent,
  loader: async () => {
    try {
      const categories = await getCategoriesWithCountFn()
      return {
        categories: categories || [],
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
      return {
        categories: [],
      }
    }
  },
})

function RouteComponent() {
  const { categories } = Route.useLoaderData()

  return <Page categories={categories} />
}