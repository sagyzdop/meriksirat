import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@/components/onboarding'
import { getUserFn } from '@/lib/user'
import { homePath, needsOnboarding } from '@/lib/access/access-rules'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (!user) {
      throw redirect({ to: '/login' })
    }

    if (!needsOnboarding(user)) {
      throw redirect({ to: homePath(user) })
    }

    return { graduationDate: user.graduationDate }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { graduationDate } = Route.useRouteContext()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Page graduationDate={graduationDate} />
    </div>
  )
}
