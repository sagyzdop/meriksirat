import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { Page } from '@/components/onboarding'
import { getUserFn } from '@/lib/user'
import { CONNECT_ERROR_MESSAGES } from '@/lib/flamekeeper/rules'

const searchSchema = z.object({
  fk_error: z
    .enum(['denied', 'state', 'session', 'account', 'scope', 'token'])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/onboarding')({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const user = await getUserFn()

    if (!user) {
      throw redirect({ to: '/login' })
    }

    if (user.onboardingComplete && user.isMember) {
      throw redirect({ to: '/equipment' })
    }

    if (!user.isMember && user.flamekeeperState) {
      throw redirect({ to: '/profile' })
    }

    return { isMember: user.isMember, email: user.email }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { isMember, email } = Route.useRouteContext()
  const { fk_error } = Route.useSearch()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Page
        isMember={isMember}
        email={email}
        connectError={fk_error ? CONNECT_ERROR_MESSAGES[fk_error] : null}
      />
    </div>
  )
}
