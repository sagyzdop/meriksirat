import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/admin/storage')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/dashboard/storage', replace: true })
  },
})
