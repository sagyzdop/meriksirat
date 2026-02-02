import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/equipment/$'

export const Route = createFileRoute('/_authenticated/equipment/$')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Page />
}
