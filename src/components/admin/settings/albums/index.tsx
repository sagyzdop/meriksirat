import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NumberField, validateRange } from '../components/number-field'
import { SaveBar } from '../components/save-bar'
import { SettingsSkeleton } from '../components/settings-skeleton'
import { useSaveSettings } from '../components/use-save-settings'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

function AlbumsForm({ initial }: { initial: number }) {
  const [days, setDays] = useState(String(initial))
  const { save, pending } = useSaveSettings()
  const error = validateRange(days, 1, 365)

  return (
    <div className="space-y-6">
      <NumberField
        id="albumDeletionNoticeDays"
        label="Scheduled deletion period (days)"
        helper="Admins can schedule an album for deletion from Album Management."
        value={days}
        onChange={setDays}
        min={1}
        max={365}
        error={error}
      />
      <SaveBar
        pending={pending}
        disabled={error !== null}
        onSave={() => save({ albumDeletionNoticeDays: Number(days) })}
      />
    </div>
  )
}

export function Page() {
  const { data: settings } = useQuery(adminDashboardQueries.settings())
  return settings ? (
    <AlbumsForm initial={settings.albumDeletionNoticeDays} />
  ) : (
    <SettingsSkeleton />
  )
}
