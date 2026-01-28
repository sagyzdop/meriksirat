import { createFileRoute, redirect } from '@tanstack/react-router'
import { getUserFn } from '@/lib/user'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (user) {
      if (user.onboardingComplete) {
        throw redirect({ to: '/dashboard' })
      } else {
        throw redirect({ to: '/onboarding' })
      }
    } else {
      throw redirect({ to: '/login' })
    }
  },
  component: App,
})

function App() {}
