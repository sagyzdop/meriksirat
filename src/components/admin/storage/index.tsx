import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
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
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { useAsyncAction } from '@/hooks/use-async-action'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import {
  setFlamekeeperCapFn,
  type PoolOverview,
} from '@/lib/admin/functions/pool'
import { bytesToGb, formatGb } from '@/lib/flamekeeper/rules'
import { formatBytes } from '@/lib/format'
import { BUFFER_WARN_FRACTION } from '@/lib/buffer/usage'
import { POOL_LOW_FRACTION, isPoolLow } from '@/lib/pool/placement'
import { cn } from '@/lib/utils'
import type { BufferUsageOverview } from '@/lib/buffer/functions'

interface PageProps {
  buffer?: BufferUsageOverview | null
  bufferLoading: boolean
  pool?: PoolOverview
  poolLoading: boolean
  canEditCap: boolean
}

function BufferItem({
  usage,
  isLoading,
}: {
  usage?: BufferUsageOverview | null
  isLoading: boolean
}) {
  if (usage === undefined) {
    return isLoading ? (
      <Item variant="outline" size="sm">
        <Skeleton className="h-10 w-full" />
      </Item>
    ) : null
  }

  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <HardDrive />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Buffer</ItemTitle>
        {usage === null ? (
          <ItemDescription>
            Buffer usage is not available. Check that the buffer account is
            connected.
          </ItemDescription>
        ) : (
          <>
            <ItemDescription
              className={cn(usage.level !== 'ok' && 'text-destructive')}
            >
              {usage.level === 'full'
                ? 'Uploads are paused until space is freed.'
                : usage.level === 'warn'
                  ? `Over ${BUFFER_WARN_FRACTION * 100}% full. Free up space or recruit flamekeepers.`
                  : `${formatBytes(usage.usedBytes)} of ${
                      usage.limitBytes
                        ? formatBytes(usage.limitBytes)
                        : 'unknown'
                    } used`}
            </ItemDescription>
            <Progress value={usage.percent ?? 0} className="h-1" />
          </>
        )}
      </ItemContent>
      {usage !== null && (
        <ItemDescription
          className={cn(
            'font-semibold tabular-nums text-foreground',
            usage.level !== 'ok' && 'text-destructive'
          )}
        >
          {usage.percent === null ? 'Unknown' : `${usage.percent}%`}
        </ItemDescription>
      )}
    </Item>
  )
}

function PoolItem({ pool }: { pool: PoolOverview }) {
  const low = isPoolLow(pool)
  const usedPercent =
    pool.pledgedBytes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (100 * (pool.pledgedBytes - pool.freeBytes)) / pool.pledgedBytes
          )
        )
      : 100

  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <Flame />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Flamekeepers</ItemTitle>
        <ItemDescription>
          {formatGb(pool.pledgedBytes)} pledged · {formatGb(pool.usedBytes)}{' '}
          used · {pool.flamekeepers} lending
        </ItemDescription>
        <Progress value={usedPercent} className="h-1" />
      </ItemContent>
      <ItemDescription
        className={cn(
          'font-semibold tabular-nums text-foreground',
          low && 'text-destructive'
        )}
      >
        {formatGb(pool.freeBytes)} free
      </ItemDescription>
    </Item>
  )
}

function CapItem({ capBytes }: { capBytes: number }) {
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = useState(String(Math.round(bytesToGb(capBytes))))
  const { pending: isSaving, run } = useAsyncAction()

  useEffect(() => {
    setCapGb(String(Math.round(bytesToGb(capBytes))))
  }, [capBytes])

  const handleSave = async () => {
    const value = Number(capGb)
    if (!Number.isFinite(value) || value < 1) {
      toast.error('Enter a cap of at least 1 GB')
      return
    }
    await run(async () => {
      await setFlamekeeperCapFn({ data: { capGb: value } })
      await queryClient.invalidateQueries({
        queryKey: adminDashboardQueries.pool().queryKey,
      })
      toast.success('Per-account cap updated')
    }, 'Failed to save')
  }

  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <Label htmlFor="flamekeeper-cap">Per-account cap (GB)</Label>
        <ItemDescription>
          The most Drive space one flamekeeper may lend.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Input
          id="flamekeeper-cap"
          type="number"
          min={1}
          className="w-24"
          value={capGb}
          onChange={(event) => setCapGb(event.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </ItemActions>
    </Item>
  )
}

export function Page({
  buffer,
  bufferLoading,
  pool,
  poolLoading,
  canEditCap,
}: PageProps) {
  return (
    <PageContainer>
      <PageHeader
        title="Storage"
        description="Buffer and flamekeeper capacity"
      />

      <div className="max-w-2xl space-y-8">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Buffer</h2>
          <ItemGroup>
            <BufferItem usage={buffer} isLoading={bufferLoading} />
          </ItemGroup>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Flamekeepers</h2>
          <ItemGroup>
            {pool ? (
              <>
                <PoolItem pool={pool} />
                {canEditCap && <CapItem capBytes={pool.capBytes} />}
              </>
            ) : poolLoading ? (
              <Item variant="outline" size="sm">
                <Skeleton className="h-10 w-full" />
              </Item>
            ) : null}
          </ItemGroup>
          {pool && isPoolLow(pool) ? (
            <p className="text-sm text-destructive">
              Free space is below {POOL_LOW_FRACTION * 100}% of the pledge.
              Recruit flamekeepers or free up space.
            </p>
          ) : null}
        </section>
      </div>
    </PageContainer>
  )
}
