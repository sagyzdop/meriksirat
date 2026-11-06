import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ClubCodeCard } from './components/club-code-card'
import { SettingsForm, SettingsFormSkeleton } from './components/settings-form'
import type { SettingsData } from '@/lib/admin/functions/settings'

interface PageProps {
  settings?: SettingsData
  settingsLoading: boolean
  clubCode?: string
  canBroadcast: boolean
}

export function Page({
  settings,
  settingsLoading,
  clubCode,
  canBroadcast,
}: PageProps) {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Club code, booking note and operating hours"
      />
      <div className="max-w-2xl space-y-4">
        {canBroadcast && clubCode ? <ClubCodeCard clubCode={clubCode} /> : null}
        {settings ? (
          <SettingsForm settings={settings} />
        ) : settingsLoading ? (
          <SettingsFormSkeleton />
        ) : null}
      </div>
    </PageContainer>
  )
}
