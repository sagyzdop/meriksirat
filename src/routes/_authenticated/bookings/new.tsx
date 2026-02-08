import { createFileRoute } from '@tanstack/react-router'
import { NewBookingPage } from '@/components/bookings/new'
import { z } from 'zod'

const BookingNewSearchSchema = z.object({
  equipmentId: z.coerce.number().optional(),
  equipmentIds: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'number') return [val];
    if (typeof val === 'string') {
      if (val === '') return undefined;
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.map(Number);
        } catch (e) { }
      }
      if (val.includes(',')) return val.split(',').map(Number);
      return [Number(val)];
    }
    return val;
  }, z.array(z.coerce.number())).optional(),
})

export const Route = createFileRoute('/_authenticated/bookings/new')({
  component: RouteComponent,
  validateSearch: BookingNewSearchSchema,
})

function RouteComponent() {
  return <NewBookingPage />
}
