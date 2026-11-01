// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getUserFn } from '@/lib/user'
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

    if (!user.onboardingComplete || !user.isMember) {
      if (!user.isMember && user.flamekeeperState) {
        if (location.pathname !== '/profile') {
          throw redirect({ to: '/profile' })
        }
      } else {
        throw redirect({ to: '/onboarding' })
      }
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
