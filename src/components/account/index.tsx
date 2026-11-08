import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAccessRules } from '@/lib/access/access-rules'
import type { MyFlamekeeper } from '@/lib/flamekeeper/types'
import type { UserProfile } from '@/lib/user/types'
import { ClubSection } from './components/club-section'
import { FlamekeeperSection } from './components/flamekeeper-section'
import { PersonalInformationSection } from './components/personal-information-section'

interface ProfilePageProps {
  user?: UserProfile
  flamekeeper?: MyFlamekeeper | null
  connectError?: string | null
  justConnected?: boolean
}

export function Page({
  user,
  flamekeeper = null,
  connectError,
  justConnected,
}: ProfilePageProps) {
  if (!user) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        Please sign in to view your profile.
      </div>
    )
  }

  const rules = getAccessRules({
    isMember: user.isMember,
    role: (user.role as 'user' | 'manager' | 'admin' | null) ?? null,
    email: user.email,
    flamekeeperState: flamekeeper?.state ?? null,
  })
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.name ||
    user.email
  const initials =
    [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() ||
    user.email[0]?.toUpperCase() ||
    'U'

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 pt-8 pb-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar className="size-24">
          <AvatarImage src={user.image || undefined} alt="" />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="max-w-full">
          <h1 className="text-xl font-semibold">{fullName}</h1>
          <p className="text-sm break-all text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>

      <Item asChild variant="outline" size="sm">
        <Link to="/favorites/photos">
          <ItemMedia>
            <Heart className="size-4 text-muted-foreground" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>My Favorites</ItemTitle>
          </ItemContent>
        </Link>
      </Item>

      {rules.showFlamekeeperSection && (
        <FlamekeeperSection
          user={user}
          flamekeeper={flamekeeper}
          rules={rules}
          connectError={connectError}
          justConnected={justConnected}
        />
      )}
      {rules.showAboutYou && <PersonalInformationSection user={user} />}
      <ClubSection
        user={user}
        canJoinClub={rules.canJoinClub}
        canDeleteAccount={rules.canDeleteAccount}
      />
    </div>
  )
}
