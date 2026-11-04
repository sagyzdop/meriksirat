import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { JoinClubItem } from './join-club-item'
import { DeleteAccountItem } from './delete-account-item'
import type { UserProfile } from '@/lib/user/types'

interface ClubSectionProps {
  user: UserProfile
  canJoinClub: boolean
  canDeleteAccount: boolean
}

function roleLabel(role: string | null): string {
  if (role === 'admin') return 'Admin'
  if (role === 'manager') return 'Manager'
  return 'Member'
}

export function ClubSection({
  user,
  canJoinClub,
  canDeleteAccount,
}: ClubSectionProps) {
  const rows = user.isMember
    ? [
        { label: 'Status', value: user.status ?? 'Unknown' },
        { label: 'Role', value: roleLabel(user.role) },
        { label: 'Clearance', value: `Level ${user.clearanceLevel || 1}` },
        {
          label: 'Joined',
          value: new Date(user.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          }),
        },
      ]
    : []

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Club</h2>
      {rows.map((row) => (
        <Item key={row.label} variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>{row.label}</ItemTitle>
          </ItemContent>
          <ItemDescription>{row.value}</ItemDescription>
        </Item>
      ))}
      {canJoinClub && <JoinClubItem />}
      {canDeleteAccount && <DeleteAccountItem />}
    </section>
  )
}
