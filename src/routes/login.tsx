import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@/components/auth'
import { getUserFn } from '@/lib/user'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (user) {
      if (user.onboardingComplete && user.isMember) {
        throw redirect({ to: '/equipment' })
      } else if (!user.isMember && user.flamekeeperState) {
        throw redirect({ to: '/profile' })
      } else {
        throw redirect({ to: '/onboarding' })
      }
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Page />
    </div>
  )
}
