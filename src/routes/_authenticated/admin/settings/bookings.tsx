import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings/bookings'

export const Route = createFileRoute('/_authenticated/admin/settings/bookings')(
  {
    component: Page,
  }
)
