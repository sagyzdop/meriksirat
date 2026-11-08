import { Flame, HardDrive } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { BufferUsageOverview } from '@/lib/buffer/functions'
import { formatBytes } from '@/lib/format'
import { formatGb } from '@/lib/flamekeeper/rules'
import { cn } from '@/lib/utils'

interface UsageMeterProps {
  icon: LucideIcon
  label: string
  used: string
  limit: string
  percent: number | null
  alertPercent?: number | null
  alerting?: boolean
  note?: ReactNode
}

function UsageMeter({
  icon: Icon,
  label,
  used,
  limit,
  percent,
  alertPercent,
  alerting,
  note,
}: UsageMeterProps) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
        <ItemDescription className={cn(alerting && 'text-destructive')}>
          {used} of {limit}
          {percent === null ? '' : ` · ${percent}%`}
        </ItemDescription>
        <div className="relative">
          <Progress
            value={percent ?? 0}
            className={cn('h-1.5', alerting && 'bg-destructive/20')}
          />
          {alertPercent ? (
            <span
              aria-hidden
              className="absolute -top-0.5 h-2.5 w-0.5 bg-foreground/60"
              style={{ left: `${alertPercent}%` }}
            />
          ) : null}
        </div>
        {alertPercent || note ? (
          <ItemDescription className="text-xs">
            {note}
            {note && alertPercent ? ' · ' : ''}
            {alertPercent ? `Alert at ${alertPercent}%` : ''}
          </ItemDescription>
        ) : null}
      </ItemContent>
    </Item>
  )
}

function UsageSkeleton() {
  return (
    <Item variant="outline" size="sm">
      <Skeleton className="h-10 w-full" />
    </Item>
  )
}

export function BufferUsage({
  usage,
  isLoading = false,
  alertPercent,
}: {
  usage?: BufferUsageOverview | null
  isLoading?: boolean
  alertPercent?: number | null
}) {
  if (usage === undefined) return isLoading ? <UsageSkeleton /> : null

  if (usage === null) {
    return (
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <HardDrive />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Buffer</ItemTitle>
          <ItemDescription>
            Usage is not available. Check that the buffer account is connected.
          </ItemDescription>
        </ItemContent>
      </Item>
    )
  }

  return (
    <UsageMeter
      icon={HardDrive}
      label="Buffer"
      used={formatBytes(usage.usedBytes)}
      limit={formatBytes(usage.configuredLimitBytes)}
      percent={usage.percent}
      alertPercent={alertPercent}
      alerting={usage.level !== 'ok'}
      note={usage.level === 'full' ? 'Uploads are paused' : undefined}
    />
  )
}

export function PoolUsage({
  pool,
  isLoading = false,
}: {
  pool?: PoolOverview
  isLoading?: boolean
}) {
  if (!pool) return isLoading ? <UsageSkeleton /> : null

  const percent =
    pool.pledgedBytes > 0
      ? Math.round(
          Math.min(
            100,
            Math.max(
              0,
              (100 * (pool.pledgedBytes - pool.freeBytes)) / pool.pledgedBytes
            )
          )
        )
      : null
  const alerting =
    pool.pledgedBytes === 0 ||
    (percent !== null && percent >= pool.alertPercent)

  return (
    <UsageMeter
      icon={Flame}
      label="Flamekeepers"
      used={formatGb(pool.usedBytes)}
      limit={formatGb(pool.pledgedBytes)}
      percent={percent}
      alertPercent={pool.alertPercent}
      alerting={alerting}
      note={`${pool.flamekeepers} lending`}
    />
  )
}
