import { createFileRoute } from '@tanstack/react-router'
import { getAdminUserByIdFn, getUserFn } from '@/lib/user'
import { Page } from '@/components/admin/users/$.edit'

export const Route = createFileRoute('/_authenticated/admin/users/$/edit')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const userId = params._splat
    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      // Get both the target user and current admin user
      const [targetUser, currentUser] = await Promise.all([
        getAdminUserByIdFn({ data: { userId } }),
        getUserFn()
      ])

      if (!targetUser) {
        throw new Error('User not found')
      }

      if (!currentUser) {
        throw new Error('Current user not found')
      }

      return { 
        targetUser,
        currentUser,
        userId 
      }
    } catch (error) {
      console.error('Failed to load user:', error)
      throw new Error('Failed to load user data')
    }
  },
})

function RouteComponent() {
  const { targetUser, currentUser, userId } = Route.useLoaderData()
  return <Page targetUser={targetUser} currentUser={currentUser} userId={userId} />
}