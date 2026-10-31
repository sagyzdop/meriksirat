import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@/components/onboarding'
import { getUserFn } from '@/lib/user'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (user?.onboardingComplete && user.isMember) {
      throw redirect({ to: '/equipment' })
    }

    return { isMember: user?.isMember ?? false }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { isMember } = Route.useRouteContext()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Page isMember={isMember} />
    </div>
  )
}
