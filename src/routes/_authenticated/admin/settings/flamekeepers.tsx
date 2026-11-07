import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings/flamekeepers'

export const Route = createFileRoute(
  '/_authenticated/admin/settings/flamekeepers'
)({
  component: Page,
})
