import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/favorites'

export const Route = createFileRoute('/_authenticated/favorites')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Page>
      <Outlet />
    </Page>
  )
}
