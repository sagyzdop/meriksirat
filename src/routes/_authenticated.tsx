// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getUserFn } from '@/lib/user'
import { needsOnboarding, nonMemberCanVisit } from '@/lib/access/access-rules'
import { AuthenticatedShell } from '@/components/root/authenticated-shell'

export const Route = createFileRoute('/_authenticated')({
  // Authenticated pages are rendered client-side only: the server still runs
  // beforeLoad/loaders (auth gate + data), but skips React SSR, which was
  // burning 40-90ms of CPU per document load on the free Workers plan.
  ssr: 'data-only',
  beforeLoad: async ({ location }) => {
    const user = await getUserFn()

    if (!user) {
      throw redirect({ to: '/login' })
    }

    if (needsOnboarding(user)) {
      throw redirect({ to: '/onboarding' })
    }

    if (!user.isMember && !nonMemberCanVisit(location.pathname)) {
      throw redirect({ to: '/account' })
    }

    return { user }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()

  return (
    <AuthenticatedShell user={user}>
      <Outlet />
    </AuthenticatedShell>
  )
}
