// The flamekeepers page answers one question first: how much room is left in
// the pool? The bar under the headline is the pool itself — one segment per
// flamekeeper, sized by pledge and filled by usage. Everything else on the page
// hangs off it: who needs attention, who is in the roster, what can be reclaimed.
import * as React from 'react'
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
import { PageContainer } from '@/components/layout/page-container'
import { useAsyncAction } from '@/hooks/use-async-action'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import {
  setFlamekeeperCapFn,
  type PoolOverview,
} from '@/lib/admin/functions/pool'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import { bytesToGb, formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { cn } from '@/lib/utils'
import { ReclaimQueue } from './components/reclaim'
import { FlamekeeperRoster } from './components/roster'
import { STATE_FILL } from './components/state-badge'
import { attentionItems, relativeTime } from './issues'
import type { FlamekeeperFilters } from './types'

function CapEditor({ capBytes }: { capBytes: number }) {
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = React.useState(
    String(Math.round(bytesToGb(capBytes)))
  )
  const [open, setOpen] = React.useState(false)
  const { pending: isSaving, run } = useAsyncAction()

  React.useEffect(() => {
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
      <PopoverContent align="start" className="w-64 space-y-3">
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

function CapacityHero({
  rows,
  pool,
  isLoading,
  canEditCap,
  onSelect,
}: {
  rows: AdminFlamekeeperRow[]
  pool?: PoolOverview
  isLoading: boolean
  canEditCap: boolean
  onSelect: (userId: string) => void
}) {
  const now = React.useMemo(() => new Date(), [])
  const lastCheck = rows.reduce<Date | null>((latest, row) => {
    if (!row.healthCheckedAt) return latest
    return !latest || row.healthCheckedAt > latest
      ? row.healthCheckedAt
      : latest
  }, null)
  const segments = rows.filter((row) => row.pledgedBytes > 0)

  return (
    <section aria-label="Pool capacity" className="space-y-5">
      <div>
        {pool ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {formatGb(pool.freeBytes)}
              </span>
              <span className="text-sm text-muted-foreground">
                free of {formatGb(pool.pledgedBytes)} pledged
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatGb(pool.usedBytes)} in use ·{' '}
              {pool.flamekeepers === 1
                ? '1 flamekeeper lending'
                : `${pool.flamekeepers} flamekeepers lending`}
              {lastCheck && <> · checked {relativeTime(lastCheck, now)}</>}
            </p>
          </>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Capacity is unavailable.
          </p>
        )}
      </div>

      {segments.length > 0 ? (
        <div
          className="flex h-3 w-full gap-0.5"
          role="group"
          aria-label="Pledged space by flamekeeper"
        >
          {segments.map((row) => {
            const percent = Math.min(
              100,
              (100 * row.usedBytes) / row.pledgedBytes
            )
            const danger = row.state === 'lost' || Boolean(row.bannedAt)

            return (
              <button
                key={row.userId}
                type="button"
                onClick={() => onSelect(row.userId)}
                title={`${row.name}: ${formatGb(row.usedBytes)} of ${formatGb(
                  row.pledgedBytes
                )} used`}
                aria-label={`${row.name}, ${formatGb(
                  row.usedBytes
                )} of ${formatGb(row.pledgedBytes)} used`}
                className="relative h-full min-w-[3px] overflow-hidden rounded-[2px] bg-muted transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ flexGrow: row.pledgedBytes, flexBasis: 0 }}
              >
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-[2px]',
                    danger ? 'bg-red-500/80' : STATE_FILL[row.state]
                  )}
                  style={{ width: `${percent}%` }}
                />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="h-3 w-full rounded-[2px] bg-muted" aria-hidden="true" />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Each segment is one flamekeeper, filled by usage.</span>
        {pool && (
          <>
            <span aria-hidden="true">·</span>
            {canEditCap ? (
              <CapEditor capBytes={pool.capBytes} />
            ) : (
              <span>{formatGb(pool.capBytes)} cap each</span>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function AttentionPanel({
  rows,
  pool,
}: {
  rows: AdminFlamekeeperRow[]
  pool?: PoolOverview
}) {
  const now = React.useMemo(() => new Date(), [])
  const items = attentionItems(rows, pool, now)
  if (items.length === 0) return null

  return (
    <section
      aria-label="Needs attention"
      className="rounded-lg border bg-muted/30 px-4 py-3"
    >
      <h2 className="text-sm font-medium">Needs attention</h2>
      <ul className="mt-1 divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-2">
            <span
              className={cn(
                'mt-1.5 size-1.5 shrink-0 rounded-full',
                item.severity === 'danger' ? 'bg-red-500' : 'bg-amber-500'
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 text-sm">
              <span className="font-medium">{item.title}.</span>{' '}
              <span className="text-muted-foreground">{item.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface PageProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperFilters
  pool?: PoolOverview
  poolLoading: boolean
  suggestions?: FreeSpaceSuggestion[]
  offloadLoading: boolean
  canEditCap: boolean
  canManageOffload: boolean
  canBan: boolean
  viewerId?: string
  isLoading: boolean
}

export function Page({
  rows,
  filters,
  pool,
  poolLoading,
  suggestions,
  offloadLoading,
  canEditCap,
  canManageOffload,
  canBan,
  viewerId,
  isLoading,
}: PageProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const now = React.useMemo(() => new Date(), [])

  const handleSelect = (userId: string) => {
    setExpandedId(userId)
    requestAnimationFrame(() => {
      document
        .getElementById(`flamekeeper-${userId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <PageContainer>
      <div className="space-y-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Flamekeepers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The club's Google Drive space, lent by its members.
          </p>
        </header>

        <CapacityHero
          rows={rows}
          pool={pool}
          isLoading={poolLoading}
          canEditCap={canEditCap}
          onSelect={handleSelect}
        />

        <AttentionPanel rows={rows} pool={pool} />

        <FlamekeeperRoster
          rows={rows}
          filters={filters}
          isLoading={isLoading}
          canBan={canBan}
          viewerId={viewerId}
          expandedId={expandedId}
          onExpandedChange={setExpandedId}
          now={now}
        />

        {canManageOffload && (
          <ReclaimQueue
            suggestions={suggestions ?? []}
            isLoading={offloadLoading}
          />
        )}
      </div>
    </PageContainer>
  )
}
