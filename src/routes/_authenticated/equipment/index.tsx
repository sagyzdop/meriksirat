import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/equipment/index'
import { equipmentQueries, equipmentEmptyResponse } from '@/lib/equipment'
import { bookingsQueries } from '@/lib/booking'
import { z } from 'zod'

const searchSchema = z.object({
  categoryId: z.coerce.number().optional(),
  searchQuery: z.string().optional(),
  mode: z.enum(['add-to-booking']).optional(),
  bookingId: z.coerce.number().optional(),
  returnTo: z.string().optional(),
  availabilityStartDate: z.string().optional(),
  availabilityEndDate: z.string().optional(),
  availabilityStartTime: z.string().optional(),
  availabilityEndTime: z.string().optional(),
  availabilityOnly: z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return undefined
    if (typeof v === 'boolean') return v
    return v === 'true'
  }, z.boolean().optional()),
})

export const Route = createFileRoute('/_authenticated/equipment/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    const queryClient = context.queryClient
    const tasks: Promise<unknown>[] = [
      queryClient.ensureQueryData(equipmentQueries.list()),
      queryClient.ensureQueryData(equipmentQueries.categories()),
      // Prefetch operating hours so the availability window default (nearest
      // 30-min bookable window) is computed correctly on first render.
      queryClient.ensureQueryData(bookingsQueries.settings()),
    ]
    if (deps.search.mode === 'add-to-booking' && deps.search.bookingId) {
      tasks.push(
        queryClient.ensureQueryData(
          bookingsQueries.bookingItemEquipmentIds(deps.search.bookingId)
        ),
        queryClient.ensureQueryData(
          bookingsQueries.bookingWindow(deps.search.bookingId)
        )
      )
    }
    try {
      await Promise.all(tasks)
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
  const { data: bookingEquipmentIds } = useQuery(
    bookingsQueries.bookingItemEquipmentIds(filters.bookingId)
  )

  return (
    <Page
      equipment={response.data}
      categories={categories ?? []}
      filters={filters}
      disabledEquipmentIds={bookingEquipmentIds ?? []}
      isLoading={
        isRouterPending || (isFetching && equipmentResponse === undefined)
      }
    />
  )
}
