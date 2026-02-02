import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/equipment/index/page'

export const Route = createFileRoute('/_authenticated/equipment/')({
  component: Page,
})
