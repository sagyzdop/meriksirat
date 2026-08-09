// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getUserFn } from '@/lib/user'
import { AuthenticatedShell } from '@/components/root/authenticated-shell'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (!user) {
      throw redirect({ to: '/login' })
    }

    if (!user.onboardingComplete) {
      throw redirect({ to: '/onboarding' })
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
