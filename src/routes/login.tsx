import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@/components/auth'
import { getUserFn } from '@/lib/user'
import { homePath } from '@/lib/access/access-rules'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (user) {
      throw redirect({ to: homePath(user) })
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
