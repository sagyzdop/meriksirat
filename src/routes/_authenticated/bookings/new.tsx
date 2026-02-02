import { createFileRoute } from '@tanstack/react-router'
import { NewBookingPage } from '@/components/bookings/new'
import { z } from 'zod'

const BookingNewSearchSchema = z.object({
  equipmentId: z.coerce.number().optional(),
})

export const Route = createFileRoute('/_authenticated/bookings/new')({
  component: RouteComponent,
  validateSearch: BookingNewSearchSchema,
})

function RouteComponent() {
  return <NewBookingPage />
}
