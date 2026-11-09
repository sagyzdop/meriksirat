import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { Page } from '@/components/auth'
import { PublicAlbumsFooter } from '@/components/albums/public-layout'
import { getUserFn } from '@/lib/user'
import { postLoginPath } from '@/lib/access/access-rules'

const searchSchema = z.object({
  redirect: z.string().max(500).optional().catch(undefined),
  error: z.string().max(100).optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const user = await getUserFn()

    if (user) {
      throw redirect({ href: postLoginPath(user, search.redirect) })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center">
        <Page error={search.error} redirect={search.redirect} />
      </div>
      <PublicAlbumsFooter />
    </div>
  )
}
