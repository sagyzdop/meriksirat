import { createFileRoute, Outlet } from '@tanstack/react-router'
import { getUserFn } from '@/lib/user'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    // Get user data using the same pattern as parent route
    const user = await getUserFn()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Check if user has admin or manager role
    if (!user.role || !['admin', 'manager'].includes(user.role)) {
      // Log unauthorized access attempt for security auditing
      console.warn(
        `Unauthorized admin access attempt by user ${user.id} with role ${user.role || 'null'}`
      )
      throw new Error('Page not found')
    }

    return { adminUser: user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return <Outlet />
}
