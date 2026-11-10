import { createFileRoute, Outlet } from '@tanstack/react-router'
import { UserError } from '@/lib/user-error'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: ({ context }) => {
    const { user } = context

    if (!user.role || !['admin', 'manager'].includes(user.role)) {
      console.warn(
        `Unauthorized admin access attempt by user ${user.id} with role ${user.role || 'null'}`
      )
      throw new UserError('Page not found')
    }

    return { adminUser: user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return <Outlet />
}
