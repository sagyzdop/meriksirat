import { Badge } from '@/components/ui/badge'
import type { FlamekeeperState } from '@/lib/access/access-rules'
import { cn } from '@/lib/utils'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import type { FlamekeeperStatus } from '../types'

const STATE_LABEL: Record<FlamekeeperState, FlamekeeperStatus> = {
  active: 'Active',
  full: 'Full',
  draining: 'Draining',
  lost: 'Lost',
  drained: 'Stopped',
}

export function flamekeeperStatus(
  row: Pick<AdminFlamekeeperRow, 'state' | 'bannedAt'>
): FlamekeeperStatus {
  return row.bannedAt ? 'Banned' : STATE_LABEL[row.state]
}

export const STATE_VARIANT = {
  active: 'default',
  full: 'secondary',
  draining: 'outline',
  lost: 'destructive',
  drained: 'secondary',
} as const

export const STATE_DOT: Record<FlamekeeperState, string> = {
  active: 'bg-emerald-500',
  full: 'bg-amber-500',
  draining: 'bg-sky-500',
  lost: 'bg-red-500',
  drained: 'bg-muted-foreground/40',
}

export const STATE_FILL: Record<FlamekeeperState, string> = {
  active: 'bg-foreground/65',
  full: 'bg-amber-500/80',
  draining: 'bg-sky-500/80',
  lost: 'bg-red-500/80',
  drained: 'bg-muted-foreground/40',
}

export function StateDot({
  state,
  className,
}: {
  state: FlamekeeperState
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        STATE_DOT[state],
        className
      )}
      title={`Flamekeeping: ${state}`}
      aria-label={`Flamekeeping: ${state}`}
    />
  )
}

export function StatusBadge({
  row,
}: {
  row: Pick<AdminFlamekeeperRow, 'state' | 'bannedAt' | 'banReason'>
}) {
  if (row.bannedAt) {
    return (
      <Badge variant="destructive" title={row.banReason ?? undefined}>
        Banned
      </Badge>
    )
  }
  return (
    <Badge variant={STATE_VARIANT[row.state]}>{STATE_LABEL[row.state]}</Badge>
  )
}

export function StateBadge({ state }: { state: FlamekeeperState }) {
  return <Badge variant={STATE_VARIANT[state]}>{state}</Badge>
}
