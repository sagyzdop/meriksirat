import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { getAdminUserByIdFn, getUserFn } from '@/lib/user'
import { Page } from '@/components/admin/users/$.edit'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute('/_authenticated/admin/users/$userId/edit')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const userId = params.userId
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
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })
  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page targetUser={targetUser} currentUser={currentUser} userId={userId} />
    </div>
  )
}