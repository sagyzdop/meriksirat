import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { getAdminUserByIdFn } from '@/lib/user'
import { Page } from '@/components/admin/users/$userId'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute('/_authenticated/admin/users/$userId')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const userId = params.userId
    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      const user = await getAdminUserByIdFn({ data: { userId } })

      if (!user) {
        throw new Error('User not found')
      }

      return { user }
    } catch (error) {
      console.error('Failed to load user:', error)
      throw new Error('Failed to load user data')
    }
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData()
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })
  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page user={user} />
    </div>
  )
}
