import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/dashboard'

export const Route = createFileRoute('/_authenticated/admin/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Page />
}
