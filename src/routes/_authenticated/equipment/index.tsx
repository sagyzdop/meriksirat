import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/equipment/index'
import { equipmentQueries, equipmentEmptyResponse } from '@/lib/equipment'
import { z } from 'zod'

const searchSchema = z.object({
  categoryId: z.coerce.number().optional(),
  searchQuery: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/equipment/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: () => ({}),
  loader: async ({ context }) => {
    const queryClient = context.queryClient
    try {
      await Promise.all([
        queryClient.ensureQueryData(equipmentQueries.list()),
        queryClient.ensureQueryData(equipmentQueries.categories()),
      ])
    } catch (error) {
      console.error('Failed to load equipment:', error)
    }
  },
})

function RouteComponent() {
  const { data: equipmentResponse, isFetching } = useQuery(
    equipmentQueries.list()
  )
  const { data: categories } = useQuery(equipmentQueries.categories())
  const response = equipmentResponse ?? equipmentEmptyResponse()
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })
  const filters = Route.useSearch()

  return (
    <Page
      equipment={response.data}
      categories={categories ?? []}
      filters={filters}
      isLoading={isRouterPending || (isFetching && equipmentResponse === undefined)}
    />
  )
}
