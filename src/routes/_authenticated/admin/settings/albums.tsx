import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings/albums'

export const Route = createFileRoute('/_authenticated/admin/settings/albums')({
  component: Page,
})
