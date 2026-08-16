import { createFileRoute } from '@tanstack/react-router'
import { NewBookingPage } from '@/components/bookings/new'
import { bookingsQueries } from '@/lib/booking'
import { numberArrayParam } from '@/lib/search-params'
import { z } from 'zod'

const BookingNewSearchSchema = z.object({
  equipmentId: z.coerce.number().optional(),
  equipmentIds: numberArrayParam(),
})

export const Route = createFileRoute('/_authenticated/bookings/new')({
  component: RouteComponent,
  validateSearch: BookingNewSearchSchema,
  loader: async ({ context }) => {
    // Prefetch operating hours so the time slot picker can restrict its slots
    // before the first render instead of flashing every slot at the default
    // 0-1439 range until the settings query resolves.
    try {
      await context.queryClient.ensureQueryData(bookingsQueries.settings())
    } catch (error) {
      console.error('Failed to load booking settings:', error)
    }
  },
})

function RouteComponent() {
  return <NewBookingPage />
}
