import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import { NumberField, validateRange } from '../components/number-field'
import { SaveBar } from '../components/save-bar'
import { SettingsSkeleton } from '../components/settings-skeleton'
import { useSaveSettings } from '../components/use-save-settings'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsyncAction } from '@/hooks/use-async-action'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { setFlamekeeperCapFn } from '@/lib/admin/functions/pool'
import { bytesToGb } from '@/lib/flamekeeper/rules'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SettingsData } from '@/lib/admin/functions/settings'
import type { BufferUsageOverview } from '@/lib/buffer/functions'

interface PageProps {
  buffer?: BufferUsageOverview | null
  bufferLoading: boolean
  capBytes?: number
  canEditCap: boolean
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
  const percent = usage?.percent ?? null

  return (
    <div className="space-y-6">
      <ItemGroup className="gap-2">
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <HardDrive />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>All available</ItemTitle>
            <ItemDescription>Drive quota of the buffer account</ItemDescription>
          </ItemContent>
          <ItemDescription className="font-semibold tabular-nums text-foreground">
            {usage?.availableLimitBytes
              ? formatBytes(usage.availableLimitBytes)
              : 'Unknown'}
          </ItemDescription>
        </Item>

        <Item variant="outline" size="sm">
          <ItemContent>
            <Label htmlFor="bufferLimitGb">Configured to use (GB)</Label>
            <ItemDescription>
              The app stops uploading once this ceiling is reached.
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

        <Item variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>Used</ItemTitle>
            {usage ? (
              <>
                <ItemDescription
                  className={cn(usage.level !== 'ok' && 'text-destructive')}
                >
                  {formatBytes(usage.usedBytes)} of{' '}
                  {formatBytes(usage.configuredLimitBytes)} configured
                </ItemDescription>
                <Progress value={percent ?? 0} className="h-1" />
              </>
            ) : (
              <ItemDescription>
                Buffer usage is not available. Check that the buffer account is
                connected.
              </ItemDescription>
            )}
          </ItemContent>
          {usage ? (
            <ItemDescription
              className={cn(
                'font-semibold tabular-nums text-foreground',
                usage.level !== 'ok' && 'text-destructive'
              )}
            >
              {percent === null ? 'Unknown' : `${percent}%`}
            </ItemDescription>
          ) : null}
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

function CapItem({ capBytes }: { capBytes: number }) {
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = useState(String(Math.round(bytesToGb(capBytes))))
  const { pending: isSaving, run } = useAsyncAction()
  const capError = validateRange(capGb, 1, 1024, false)

  const handleSave = async () => {
    if (capError) {
      toast.error(capError)
      return
    }
    await run(async () => {
      await setFlamekeeperCapFn({ data: { capGb: Number(capGb) } })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Per-account cap updated')
    }, 'Failed to save')
  }

  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <Label htmlFor="flamekeeper-cap">Per-account cap (GB)</Label>
        <ItemDescription>
          The app stops using a flamekeeper's account once its total Drive usage
          reaches this. Pledges are separate: 0.5, 1, 2, 3, 4 or 5 GB.
        </ItemDescription>
        {capError ? (
          <p className="text-sm text-destructive">{capError}</p>
        ) : null}
      </ItemContent>
      <ItemActions>
        <Input
          id="flamekeeper-cap"
          type="number"
          min={1}
          className="w-24"
          value={capGb}
          aria-invalid={capError ? true : undefined}
          onChange={(event) => setCapGb(event.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || capError !== null}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </ItemActions>
    </Item>
  )
}

function PoolLowItem({ settings }: { settings: SettingsData }) {
  const [percent, setPercent] = useState(String(settings.poolLowAlertPercent))
  const { save, pending } = useSaveSettings()
  const error = validateRange(percent, 50, 99)

  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <Label htmlFor="poolLowAlertPercent">Pool-low alert (% used)</Label>
        <ItemDescription>
          Alert when used pledged space reaches this share of the pledge.
        </ItemDescription>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </ItemContent>
      <ItemActions>
        <Input
          id="poolLowAlertPercent"
          type="number"
          min={50}
          max={99}
          className="w-24"
          value={percent}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setPercent(event.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => save({ poolLowAlertPercent: Number(percent) })}
          disabled={pending || error !== null}
        >
          {pending ? 'Saving...' : 'Save'}
        </Button>
      </ItemActions>
    </Item>
  )
}

export function Page({
  buffer,
  bufferLoading,
  capBytes,
  canEditCap,
}: PageProps) {
  const { data: settings } = useQuery(adminDashboardQueries.settings())

  return (
    <>
      {settings && buffer !== undefined ? (
        <BufferForm settings={settings} usage={buffer} />
      ) : bufferLoading || !settings ? (
        <SettingsSkeleton />
      ) : null}

      {canEditCap ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Flamekeepers</h2>
          {capBytes !== undefined ? (
            <ItemGroup className="gap-2">
              <CapItem capBytes={capBytes} />
              {settings ? <PoolLowItem settings={settings} /> : null}
            </ItemGroup>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </section>
      ) : null}
    </>
  )
}
