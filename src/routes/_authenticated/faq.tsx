import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/faq'

export const Route = createFileRoute('/_authenticated/faq')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Page />
  )
}
