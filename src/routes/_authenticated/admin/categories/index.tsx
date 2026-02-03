import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/categories/index'
import { getCategoriesWithCountFn } from '@/lib/admin'

import { CategorySortSchema } from '@/lib/admin';

export const Route = createFileRoute('/_authenticated/admin/categories/')({
  validateSearch: (search) => CategorySortSchema.optional().catch(undefined).parse(search),
  loaderDeps: ({ search }) => ({ sortBy: search?.sortBy, order: search?.order }),
  component: RouteComponent,
  loader: async ({ deps: { sortBy, order } }) => {
    try {
      const categories = await getCategoriesWithCountFn({
        data: { sortBy, order }
      })
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
  const search = Route.useSearch()

  return <Page categories={categories} sortBy={search?.sortBy} order={search?.order} />
}