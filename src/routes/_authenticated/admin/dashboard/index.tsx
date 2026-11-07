import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/admin/dashboard/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/dashboard/bookings', replace: true })
  },
})
