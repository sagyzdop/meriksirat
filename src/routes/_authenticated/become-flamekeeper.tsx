import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { Page } from '@/components/become-flamekeeper'
import { getAccessRules } from '@/lib/access/access-rules'
import {
  CONNECT_ERROR_MESSAGES,
  CONNECT_ERROR_CODES,
} from '@/lib/flamekeeper/rules'

const searchSchema = z.object({
  fk_error: z.enum(CONNECT_ERROR_CODES).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/become-flamekeeper')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    const { user } = context
    const rules = getAccessRules({
      isMember: user.isMember,
      role: (user.role as 'user' | 'manager' | 'admin' | null) ?? null,
      email: user.email,
      flamekeeperState: user.flamekeeperState ?? null,
    })
    if (!rules.canBecomeFlamekeeper || user.isMaster) {
      throw redirect({ to: '/profile', search: { fk_error: search.fk_error } })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  return (
    <Page
      graduationDate={user.graduationDate}
      connectError={
        search.fk_error ? CONNECT_ERROR_MESSAGES[search.fk_error] : null
      }
    />
  )
}
