import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { ProfileHeader } from './components/profile-header'
import { ProfileContent } from './components/profile-content'
import { FlamekeeperCard } from './components/flamekeeper-card'
import { JoinClubCard } from './components/join-club-card'
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
          description="Your flamekeeper contribution and membership"
        />
        <div className="space-y-8">
          <Section spacing="compact">
            <ProfileHeader user={user} />
          </Section>
          <Section>{flamekeeperCard}</Section>
          <Section>
            <h2 className="mb-3 text-lg font-semibold">Join the club</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Already part of NU Image? Enter the club code to become a member.
              Your pledge and photos stay exactly as they are.
            </p>
            <JoinClubCard />
          </Section>
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
        <Section>{flamekeeperCard}</Section>
        <Section>
          <ProfileContent user={user} />
        </Section>
      </div>
    </PageContainer>
  )
}
