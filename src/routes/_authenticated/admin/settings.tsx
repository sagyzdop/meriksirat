import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/settings'
import { getSettingsFn } from '@/lib/admin/functions/settings'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: RouteComponent,
  loader: async () => {
    try {
      const settings = await getSettingsFn()
      return {
        settings: settings || {
          id: 'global',
          globalBookingNote: '',
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
  
  return <Page settings={settings} />
}
