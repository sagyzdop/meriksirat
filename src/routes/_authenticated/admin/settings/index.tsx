import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/admin/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/settings/members', replace: true })
  },
})
