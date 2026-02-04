import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@/components/onboarding'
import { getUserFn } from '@/lib/user'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (user?.onboardingComplete) {
      throw redirect({ to: '/equipment' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Page />
    </div>
  )
}
