import { createFileRoute, redirect } from '@tanstack/react-router'
import { Page } from '@/components/auth'
import { PublicAlbumsFooter } from '@/components/albums/public-layout'
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
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center">
        <Page />
      </div>
      <PublicAlbumsFooter />
    </div>
  )
}
