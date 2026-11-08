import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { NumberField, validateRange } from '../components/number-field'
import { SaveBar } from '../components/save-bar'
import { SettingsSkeleton } from '../components/settings-skeleton'
import { useSaveSettings } from '../components/use-save-settings'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from '@/components/ui/item'
import { BufferAccount } from './buffer-account'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BufferUsage, PoolUsage } from '@/components/shared/storage-usage'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsyncAction } from '@/hooks/use-async-action'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { setFlamekeeperCapFn } from '@/lib/admin/functions/pool'
import { updateSettingsFn } from '@/lib/admin/functions/settings'
import { bytesToGb } from '@/lib/flamekeeper/rules'
import { formatBytes } from '@/lib/format'
import type { SettingsData } from '@/lib/admin/functions/settings'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { BufferUsageOverview } from '@/lib/buffer/functions'

interface PageProps {
  buffer?: BufferUsageOverview | null
  bufferLoading: boolean
  pool?: PoolOverview
  canEditCap: boolean
  connected?: boolean
  connectError?: string
}

function gbString(bytes: number) {
  return String(Math.round(bytesToGb(bytes) * 100) / 100)
}

function BufferForm({
  settings,
  usage,
}: {
  settings: SettingsData
  usage: BufferUsageOverview | null
}) {
  const [limitGb, setLimitGb] = useState(gbString(settings.bufferLimitBytes))
  const [alertPercent, setAlertPercent] = useState(
    String(settings.bufferAlertPercent)
  )
  const { save, pending } = useSaveSettings()

  const usedGb = usage ? bytesToGb(usage.usedBytes) : 0
  const limitValue = Number(limitGb)
  const limitError =
    validateRange(limitGb, 0, 1_000_000, false) ??
    (limitValue <= 0
      ? 'Must be greater than 0'
      : limitValue < usedGb
        ? `Must be at least the ${formatBytes(usage?.usedBytes ?? 0)} already used`
        : null)
  const alertError = validateRange(alertPercent, 50, 99)

  return (
    <div className="space-y-6">
      <ItemGroup className="gap-2">
        <BufferUsage usage={usage} alertPercent={Number(alertPercent)} />
        <Item variant="outline" size="sm">
          <ItemContent>
            <Label htmlFor="bufferLimitGb">Limit (GB)</Label>
            <ItemDescription>
              Uploads stop once this ceiling is reached.
              {usage?.availableLimitBytes
                ? ` Drive quota: ${formatBytes(usage.availableLimitBytes)}.`
                : ''}
            </ItemDescription>
            {limitError ? (
              <p className="text-sm text-destructive">{limitError}</p>
            ) : null}
          </ItemContent>
          <ItemActions>
            <Input
              id="bufferLimitGb"
              type="number"
              min={0}
              step="any"
              className="w-28"
              value={limitGb}
              aria-invalid={limitError ? true : undefined}
              onChange={(event) => setLimitGb(event.target.value)}
            />
          </ItemActions>
        </Item>
      </ItemGroup>

      <NumberField
        id="bufferAlertPercent"
        label="Buffer alert (% used)"
        helper="Warn when buffer usage reaches this share of the configured size."
        value={alertPercent}
        onChange={setAlertPercent}
        min={50}
        max={99}
        error={alertError}
      />

      <SaveBar
        pending={pending}
        disabled={limitError !== null || alertError !== null}
        onSave={() =>
          save({
            bufferLimitBytes: limitValue,
            bufferAlertPercent: Number(alertPercent),
          })
        }
      />
    </div>
  )
}

function FlamekeeperForm({
  settings,
  pool,
}: {
  settings: SettingsData
  pool: PoolOverview
}) {
  const capBytes = pool.capBytes
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = useState(String(Math.round(bytesToGb(capBytes))))
  const [percent, setPercent] = useState(String(settings.poolLowAlertPercent))
  const { pending, run } = useAsyncAction()

  const capError = validateRange(capGb, 1, 1024, false)
  const alertError = validateRange(percent, 50, 99)

  const handleSave = () =>
    run(async () => {
      await setFlamekeeperCapFn({ data: { capGb: Number(capGb) } })
      await updateSettingsFn({
        data: { poolLowAlertPercent: Number(percent) },
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Settings updated successfully')
    }, 'Failed to update settings')

  return (
    <div className="space-y-6">
      <PoolUsage pool={{ ...pool, alertPercent: Number(percent) }} />
      <ItemGroup className="gap-2">
        <NumberField
          id="flamekeeper-cap"
          label="Per-account cap (GB)"
          helper="The app stops using a flamekeeper's account once its total Drive usage reaches this. Pledges are separate: 0.5, 1, 2, 3, 4 or 5 GB."
          value={capGb}
          onChange={setCapGb}
          min={1}
          max={1024}
          error={capError}
        />
        <NumberField
          id="poolLowAlertPercent"
          label="Pool-low alert (% used)"
          helper="Alert when used pledged space reaches this share of the pledge."
          value={percent}
          onChange={setPercent}
          min={50}
          max={99}
          error={alertError}
        />
      </ItemGroup>
      <SaveBar
        pending={pending}
        disabled={capError !== null || alertError !== null}
        onSave={handleSave}
      />
    </div>
  )
}

export function Page({
  buffer,
  bufferLoading,
  pool,
  canEditCap,
  connected,
  connectError,
}: PageProps) {
  const { data: settings } = useQuery(adminDashboardQueries.settings())

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Buffer</h2>
        <BufferAccount connected={connected} connectError={connectError} />
        {settings && buffer !== undefined ? (
          <BufferForm settings={settings} usage={buffer} />
        ) : bufferLoading || !settings ? (
          <SettingsSkeleton />
        ) : null}
      </section>

      {canEditCap ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Flamekeepers</h2>
          {settings && pool ? (
            <FlamekeeperForm settings={settings} pool={pool} />
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </section>
      ) : null}
    </>
  )
}
