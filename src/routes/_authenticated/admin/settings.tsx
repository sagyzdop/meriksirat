import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Page />
}
