import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/about'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About | NU Image' },
      {
        name: 'description',
        content:
          'What NU Image is, how flamekeepers keep the albums online, and how long albums last.',
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <Page />
}
