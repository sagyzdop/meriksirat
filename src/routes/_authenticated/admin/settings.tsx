import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings'
import { getSettingsFn } from '@/lib/admin/functions/settings'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: RouteComponent,
  loader: async () => {
    try {
      const settings = await getSettingsFn()
      return {
        settings: settings || {
          id: 'global',
          globalBookingNote: '',
          birthdaysCalendarId: '',
          operatingHoursStart: 0,
          operatingHoursEnd: 1439,
          createdAt: null,
          updatedAt: null,
        },
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      return {
        settings: {
          id: 'global',
          globalBookingNote: '',
          birthdaysCalendarId: '',
          operatingHoursStart: 0,
          operatingHoursEnd: 1439,
          createdAt: null,
          updatedAt: null,
        },
      }
    }
  },
})

function RouteComponent() {
  const { settings } = Route.useLoaderData()
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page settings={settings} />
    </div>
  )
}
