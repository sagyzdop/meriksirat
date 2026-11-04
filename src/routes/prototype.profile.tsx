// PROTOTYPE: four whole-page profile layouts in the real app shell, mock data, no login.
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthenticatedShell } from '@/components/root/authenticated-shell'
import {
  VariantA,
  VariantB,
  VariantC,
  VariantD,
  VariantE,
  type ProfileState,
} from '@/components/prototype/profile-variants'
import { PrototypeSwitcher } from '@/components/prototype/prototype-switcher'
import type { UserProfile } from '@/lib/user/types'

const VARIANTS = [
  { key: 'A', name: 'Flat rows, edit in place' },
  { key: 'B', name: 'Settings groups, edit in a dialog' },
  { key: 'C', name: 'Field grid, edit all at once' },
  { key: 'D', name: 'Sections, always editable' },
  { key: 'E', name: 'Flat page, always editable' },
]

const STATES: Array<{ key: ProfileState; name: string }> = [
  { key: 'guest', name: 'Not a member' },
  { key: 'keeper', name: 'Only a flamekeeper' },
  { key: 'invite', name: 'Not yet' },
  { key: 'ember', name: 'Nothing stored' },
  { key: 'flame', name: 'Keeping' },
  { key: 'fading', name: 'Leaving' },
  { key: 'out', name: 'Lost' },
]

const MOCK_USER: UserProfile = {
  id: 'prototype',
  email: 'aigerim.sample@nu.edu.kz',
  emailVerified: true,
  image: null,
  name: 'Aigerim Sample',
  telegramChatId: null,
  telegramUsername: 'aigerim',
  instagramUsername: null,
  googleId: null,
  nuId: 202012345,
  firstName: 'Aigerim',
  lastName: 'Sample',
  birthday: null,
  major: 'Computer Science',
  graduationYear: 2028,
  status: 'Active',
  clearanceLevel: 3,
  role: 'user',
  isMember: true,
  onboardingComplete: true,
  createdAt: new Date('2025-09-01'),
  updatedAt: new Date('2025-09-01'),
}

export const Route = createFileRoute('/prototype/profile')({
  ssr: false,
  validateSearch: z.object({
    variant: z.enum(['A', 'B', 'C', 'D', 'E']).catch('E'),
    state: z
      .enum(['guest', 'keeper', 'invite', 'ember', 'flame', 'fading', 'out'])
      .catch('flame'),
  }),
  beforeLoad: () => {
    if (import.meta.env.VITE_ENABLE_DEVTOOLS !== 'true') throw notFound()
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { variant, state } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const go = (next: { variant?: string; state?: string }) =>
    navigate({
      search: (prev) => ({ ...prev, ...next }) as typeof prev,
      replace: true,
    })

  return (
    <AuthenticatedShell user={MOCK_USER}>
      {variant === 'A' && <VariantA state={state} />}
      {variant === 'B' && <VariantB state={state} />}
      {variant === 'C' && <VariantC state={state} />}
      {variant === 'D' && <VariantD state={state} />}
      {variant === 'E' && <VariantE state={state} />}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onVariant={(key) => go({ variant: key })}
        states={STATES}
        currentState={state}
        onState={(key) => go({ state: key })}
      />
    </AuthenticatedShell>
  )
}
