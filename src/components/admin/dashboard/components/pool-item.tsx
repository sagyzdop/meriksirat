import { Flame } from 'lucide-react'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { formatGb } from '@/lib/flamekeeper/rules'
import { isPoolLow } from '@/lib/pool/placement'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import { cn } from '@/lib/utils'

export function PoolItem({ pool }: { pool: PoolOverview }) {
  const low = isPoolLow(pool, pool.alertPercent)
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
