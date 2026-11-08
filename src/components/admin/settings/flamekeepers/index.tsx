import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NumberField, validateRange } from '../components/number-field'
import { SaveBar } from '../components/save-bar'
import { SettingsSkeleton } from '../components/settings-skeleton'
import { useSaveSettings } from '../components/use-save-settings'
import { ItemGroup } from '@/components/ui/item'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import type { SettingsData } from '@/lib/admin/functions/settings'

function FlamekeepersForm({ settings }: { settings: SettingsData }) {
  const [grace, setGrace] = useState(String(settings.lostGraceDays))
  const [graduation, setGraduation] = useState(
    String(settings.graduationPromptDays)
  )
  const { save, pending } = useSaveSettings()

  const graceError = validateRange(grace, 1, 30)
  const graduationError = validateRange(graduation, 1, 365)
  const invalid = Boolean(graceError || graduationError)

  return (
    <div className="space-y-6">
      <ItemGroup className="gap-2">
        <NumberField
          id="lostGraceDays"
          label="Lost-flamekeeper grace (days)"
          helper="How long an unreachable flamekeeper is given before being treated as lost."
          value={grace}
          onChange={setGrace}
          min={1}
          max={30}
          error={graceError}
        />
        <NumberField
          id="graduationPromptDays"
          label="Graduation prompt lead (days)"
          helper="How many days before graduation a flamekeeper is prompted."
          value={graduation}
          onChange={setGraduation}
          min={1}
          max={365}
          error={graduationError}
        />
      </ItemGroup>
      <SaveBar
        pending={pending}
        disabled={invalid}
        onSave={() =>
          save({
            lostGraceDays: Number(grace),
            graduationPromptDays: Number(graduation),
          })
        }
      />
    </div>
  )
}

export function Page() {
  const { data: settings } = useQuery(adminDashboardQueries.settings())
  return settings ? (
    <FlamekeepersForm settings={settings} />
  ) : (
    <SettingsSkeleton />
  )
}
