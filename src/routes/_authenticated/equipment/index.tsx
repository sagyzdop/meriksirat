import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/equipment/index'
import { equipmentQueries, equipmentEmptyResponse } from '@/lib/equipment'
import { z } from 'zod'

const searchSchema = z.object({
  categoryIds: z
    .preprocess((val) => {
      if (Array.isArray(val)) return val
      if (typeof val === 'number') return [val]
      if (typeof val === 'string') {
        if (val === '') return undefined
        if (val.startsWith('[') && val.endsWith(']')) {
          try {
            const parsed = JSON.parse(val)
            if (Array.isArray(parsed)) return parsed.map(Number)
          } catch (e) {}
        }
        if (val.includes(',')) return val.split(',').map(Number)
        return [Number(val)]
      }
      return val
    }, z.array(z.coerce.number()))
    .optional(),
  searchQuery: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum([
      'modelName',
      'category',
      'requiredClearanceLevel',
      'isActive',
      'createdAt',
    ])
    .default('modelName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  viewMode: z.enum(['table', 'grid']).default('table'),
})

export const Route = createFileRoute('/_authenticated/equipment/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    search: {
      categoryIds: search.categoryIds,
      searchQuery: search.searchQuery,
      page: search.page,
      limit: search.limit,
      sortBy: search.sortBy,
      sortOrder: search.sortOrder,
    },
  }),
  loader: async ({ deps, context }) => {
    const queryClient = context.queryClient
    try {
      await Promise.all([
        queryClient.ensureQueryData(equipmentQueries.list(deps.search)),
        queryClient.ensureQueryData(equipmentQueries.categories()),
      ])
    } catch (error) {
      console.error('Failed to load equipment:', error)
    }
  },
})

function RouteComponent() {
  const { search } = Route.useLoaderDeps()
  const navigate = Route.useNavigate()
  const { data: equipmentResponse, isFetching } = useQuery(
    equipmentQueries.list(search)
  )
  const { data: categories } = useQuery(equipmentQueries.categories())
  const response = equipmentResponse ?? equipmentEmptyResponse(search)
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })
  const searchWithView = Route.useSearch()

  return (
    <Page
      equipment={response.data}
      categories={categories ?? []}
      pagination={response.pagination}
      filters={searchWithView}
      isLoading={isRouterPending || isFetching}
      onViewModeChange={(mode) =>
        navigate({ search: (prev) => ({ ...prev, viewMode: mode }) })
      }
    />
  )
}
