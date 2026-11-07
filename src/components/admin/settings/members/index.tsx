import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClubCodeCard } from '../components/club-code-card'
import { SaveBar } from '../components/save-bar'
import { SettingsSkeleton } from '../components/settings-skeleton'
import { useSaveSettings } from '../components/use-save-settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

interface PageProps {
  clubCode?: string
  canBroadcast: boolean
}

function MembersForm({ initial }: { initial: string }) {
  const [calendarId, setCalendarId] = useState(initial)
  const { save, pending } = useSaveSettings()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="birthdaysCalendarId">Birthdays Calendar ID</Label>
        <Input
          id="birthdaysCalendarId"
          type="text"
          placeholder="c_xxxxx@group.calendar.google.com"
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
        />
      </div>
      <SaveBar
        pending={pending}
        onSave={() => save({ birthdaysCalendarId: calendarId })}
      />
    </div>
  )
}

export function Page({ clubCode, canBroadcast }: PageProps) {
  const { data: settings } = useQuery(adminDashboardQueries.settings())

  return (
    <>
      {canBroadcast && clubCode ? <ClubCodeCard clubCode={clubCode} /> : null}
      {settings ? (
        <MembersForm initial={settings.birthdaysCalendarId || ''} />
      ) : (
        <SettingsSkeleton />
      )}
    </>
  )
}
