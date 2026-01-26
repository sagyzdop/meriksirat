import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '@/lib/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSessionFn()

    if (session?.user) {
      throw redirect({ to: '/dashboard' })
    } else {
      throw redirect({ to: '/login' })
    }
  },
  component: App,
})

function App() {}
