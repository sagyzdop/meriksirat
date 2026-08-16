import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/equipment/index'
import { equipmentQueries, equipmentEmptyResponse } from '@/lib/equipment'
import { bookingsQueries } from '@/lib/booking'
import { Spinner } from '@/components/ui/spinner'
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
  pendingComponent: EquipmentPending,
  validateSearch: searchSchema,
  // Only depend on the values the loader actually reads. The availability
  // filters (date/time/available-only) are read client-side, so changing them
  // must reuse the existing match instead of re-running the loader — otherwise
  // every filter change drops the page into a blank pending state.
  loaderDeps: ({ search }) => ({
    mode: search.mode,
    bookingId: search.bookingId,
  }),
  loader: async ({ deps, context }) => {
    const queryClient = context.queryClient
    const tasks: Promise<unknown>[] = [
      queryClient.ensureQueryData(equipmentQueries.list()),
      queryClient.ensureQueryData(equipmentQueries.categories()),
      // Prefetch operating hours so the availability window default (nearest
      // 30-min bookable window) is computed correctly on first render.
      queryClient.ensureQueryData(bookingsQueries.settings()),
    ]
    if (deps.mode === 'add-to-booking' && deps.bookingId) {
      tasks.push(
        queryClient.ensureQueryData(
          bookingsQueries.bookingItemEquipmentIds(deps.bookingId)
        ),
        queryClient.ensureQueryData(
          bookingsQueries.bookingWindow(deps.bookingId)
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

function EquipmentPending() {
  return (
    <div className="flex h-[calc(100svh-var(--header-height))] items-center justify-center bg-background">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  )
}
