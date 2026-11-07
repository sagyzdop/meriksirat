import { Cloud, HardDrive, Settings2 } from 'lucide-react'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { BufferUsageOverview } from '@/lib/buffer/functions'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatItem } from './stat-item'

export function BufferItems({
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

  if (usage === null) {
    return (
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <HardDrive />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Buffer</ItemTitle>
          <ItemDescription>
            Buffer usage is not available. Check that the buffer account is
            connected.
          </ItemDescription>
        </ItemContent>
      </Item>
    )
  }

  return (
    <>
      <StatItem
        icon={Cloud}
        label="All available"
        value={
          usage.availableLimitBytes === null
            ? 'Unknown'
            : formatBytes(usage.availableLimitBytes)
        }
        isLoading={false}
      />
      <StatItem
        icon={Settings2}
        label="Configured to use"
        value={formatBytes(usage.configuredLimitBytes)}
        isLoading={false}
      />
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <HardDrive />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Used</ItemTitle>
          <ItemDescription
            className={cn(usage.level !== 'ok' && 'text-destructive')}
          >
            {usage.level === 'full'
              ? 'Uploads are paused until space is freed.'
              : usage.level === 'warn'
                ? 'Nearly full. Schedule albums for deletion or recruit flamekeepers.'
                : `${formatBytes(usage.usedBytes)} of ${formatBytes(
                    usage.configuredLimitBytes
                  )} configured`}
          </ItemDescription>
          <Progress value={usage.percent ?? 0} className="h-1" />
        </ItemContent>
        <ItemDescription
          className={cn(
            'font-semibold tabular-nums text-foreground',
            usage.level !== 'ok' && 'text-destructive'
          )}
        >
          {formatBytes(usage.usedBytes)}
          {usage.percent === null ? '' : ` · ${usage.percent}%`}
        </ItemDescription>
      </Item>
    </>
  )
}
