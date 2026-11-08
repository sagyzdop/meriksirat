import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/favorites/')({
  beforeLoad: () => {
    throw redirect({ to: '/favorites/photos', replace: true })
  },
})
