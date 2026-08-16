import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/admin/birthdays'
import { getUpcomingBirthdaysFn } from '@/lib/birthdays/functions/birthdays'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute('/_authenticated/admin/birthdays')({
  component: RouteComponent,
  loader: async () => {
    try {
      const birthdays = await getUpcomingBirthdaysFn({
        data: {},
      })
      return { birthdays }
    } catch (error) {
      console.error('Failed to load birthdays:', error)
      return { birthdays: [] }
    }
  },
})

function RouteComponent() {
  const { birthdays } = Route.useLoaderData()
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page birthdays={birthdays} />
    </div>
  )
}
