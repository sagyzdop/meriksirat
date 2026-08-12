import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/equipment/index'
import { equipmentQueries, adminEquipmentEmptyResponse } from '@/lib/equipment'
import { booleanArrayParam, numberArrayParam } from '@/lib/search-params'
import { z } from 'zod'

const searchSchema = z.object({
  categoryIds: numberArrayParam(),
  searchQuery: z.string().optional(),
  minClearanceLevel: z.coerce.number().optional(),
  maxClearanceLevel: z.coerce.number().optional(),
  isActive: booleanArrayParam(),
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
})

export const Route = createFileRoute('/_authenticated/admin/equipment/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    const queryClient = context.queryClient
    try {
      await Promise.all([
        queryClient.ensureQueryData(equipmentQueries.adminList(deps.search)),
        queryClient.ensureQueryData(equipmentQueries.categories()),
      ])
    } catch (error) {
      console.error('Failed to load equipment:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { data: equipmentResponse, isFetching } = useQuery(
    equipmentQueries.adminList(search)
  )
  const { data: categories } = useQuery(equipmentQueries.categories())
  const response = equipmentResponse ?? adminEquipmentEmptyResponse(search)
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      equipment={response.data}
      categories={categories ?? []}
      pagination={response.pagination}
      filters={search}
      isLoading={isRouterPending || isFetching}
    />
  )
}
