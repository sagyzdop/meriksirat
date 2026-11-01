import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { ProfileHeader } from './components/profile-header'
import { ProfileContent } from './components/profile-content'
import { FlamekeeperCard } from './components/flamekeeper-card'
import { JoinClubCard } from './components/join-club-card'
import { DeleteAccountCard } from './components/delete-account-card'
import { getAccessRules } from '@/lib/access/access-rules'
import type { UserProfile } from '@/lib/user/types'
import type { MyFlamekeeper } from '@/lib/flamekeeper/types'

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
      <PageContainer>
        <div className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">
            Please sign in to view your profile.
          </div>
        </div>
      </PageContainer>
    )
  }

  const rules = getAccessRules({
    isMember: user.isMember,
    role: (user.role as 'user' | 'manager' | 'admin' | null) ?? null,
    email: user.email,
    flamekeeperState: flamekeeper?.state ?? null,
  })
  const showFlamekeeperCard = flamekeeper !== null || rules.canBecomeFlamekeeper

  const flamekeeperCard = (
    <FlamekeeperCard
      user={user}
      flamekeeper={flamekeeper}
      connectError={connectError}
      justConnected={justConnected}
    />
  )

  if (!user.isMember) {
    return (
      <PageContainer>
        <PageHeader
          title="Account"
          description="Your account, storage pledge and membership"
        />
        <div className="space-y-8">
          <Section spacing="compact">
            <ProfileHeader user={user} />
          </Section>
          {showFlamekeeperCard && <Section>{flamekeeperCard}</Section>}
          <Section>
            <h2 className="mb-3 text-lg font-semibold">Join the club</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Already part of NU Image? Enter the club code to become a member.
              You will then add your name, NU ID and major and link Telegram.
              Your pledge and photos stay exactly as they are.
            </p>
            <JoinClubCard />
          </Section>
          {rules.canDeleteAccount && (
            <Section>
              <DeleteAccountCard />
            </Section>
          )}
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        description="Manage your account information"
      />
      <div className="space-y-8">
        <Section spacing="compact">
          <ProfileHeader user={user} />
        </Section>
        {showFlamekeeperCard && <Section>{flamekeeperCard}</Section>}
        <Section>
          <ProfileContent user={user} />
        </Section>
      </div>
    </PageContainer>
  )
}
