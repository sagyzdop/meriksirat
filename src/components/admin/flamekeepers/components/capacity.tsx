// PROTOTYPE: quiet capacity summary. Same numbers as the old panel, without
// the section heading, description and table chrome.
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsyncAction } from '@/hooks/use-async-action'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import {
  setFlamekeeperCapFn,
  type PoolOverview,
} from '@/lib/admin/functions/pool'
import { bytesToGb, formatGb } from '@/lib/flamekeeper/rules'
import { isPoolLow } from '@/lib/pool/placement'
import { cn } from '@/lib/utils'

function CapEditor({ capBytes }: { capBytes: number }) {
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = useState(String(Math.round(bytesToGb(capBytes))))
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    }, 'Failed to save')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-1 py-0 text-xs font-normal text-muted-foreground underline decoration-dotted underline-offset-4"
        >
          {formatGb(capBytes)} cap each
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="flamekeeper-admin-cap">Per-account cap (GB)</Label>
          <p className="text-xs text-muted-foreground">
            The most Drive space one flamekeeper may lend.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            id="flamekeeper-admin-cap"
            type="number"
            min={1}
            value={capGb}
            onChange={(event) => setCapGb(event.target.value)}
          />
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Stat({
  label,
  value,
  danger,
  size = 'default',
}: {
  label: string
  value: string | number
  danger?: boolean
  size?: 'default' | 'small'
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'font-semibold tabular-nums',
          size === 'small' ? 'text-lg' : 'text-xl',
          danger && 'text-destructive'
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function PoolMeter({ pool }: { pool: PoolOverview }) {
  const percent =
    pool.pledgedBytes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (100 * (pool.pledgedBytes - pool.freeBytes)) / pool.pledgedBytes
          )
        )
      : 0

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full',
          isPoolLow(pool) ? 'bg-destructive' : 'bg-foreground/70'
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function PoolStats({
  pool,
  size,
  className,
}: {
  pool: PoolOverview
  size?: 'default' | 'small'
  className?: string
}) {
  const low = isPoolLow(pool)

  return (
    <div className={cn('flex flex-wrap items-end gap-x-8 gap-y-3', className)}>
      <Stat label="Pledged" value={formatGb(pool.pledgedBytes)} size={size} />
      <Stat label="Used" value={formatGb(pool.usedBytes)} size={size} />
      <Stat
        label="Free"
        value={formatGb(pool.freeBytes)}
        danger={low}
        size={size}
      />
      <Stat
        label={pool.flamekeepers === 1 ? 'Lender' : 'Lenders'}
        value={pool.flamekeepers}
        size={size}
      />
    </div>
  )
}

export function PoolLine({
  pool,
  canEditCap = false,
}: {
  pool: PoolOverview
  canEditCap?: boolean
}) {
  const low = isPoolLow(pool)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatGb(pool.pledgedBytes)}
          </span>{' '}
          pledged
          <span aria-hidden="true"> · </span>
          <span className="font-medium text-foreground">
            {formatGb(pool.usedBytes)}
          </span>{' '}
          used
          <span aria-hidden="true"> · </span>
          <span
            className={cn(
              'font-medium',
              low ? 'text-destructive' : 'text-foreground'
            )}
          >
            {formatGb(pool.freeBytes)}
          </span>{' '}
          free
          <span aria-hidden="true"> · </span>
          {pool.flamekeepers} lending
        </p>
        {canEditCap && <CapEditor capBytes={pool.capBytes} />}
      </div>
      <PoolMeter pool={pool} />
    </div>
  )
}

interface PoolSummaryProps {
  pool?: PoolOverview
  isLoading?: boolean
  canEditCap?: boolean
}

export function PoolSummary({
  pool,
  isLoading = false,
  canEditCap = false,
}: PoolSummaryProps) {
  if (!pool) {
    return isLoading ? (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">Capacity is unavailable.</p>
    )
  }

  return (
    <section aria-label="Pool capacity" className="rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <PoolStats pool={pool} />
        {canEditCap && (
          <div className="ml-auto">
            <CapEditor capBytes={pool.capBytes} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <PoolMeter pool={pool} />
      </div>
    </section>
  )
}

export { PoolStats }
