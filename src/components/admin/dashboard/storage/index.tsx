import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Item, ItemGroup } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import type { StorageStats } from '@/lib/admin/dashboard-types'
import { isPoolLow, POOL_LOW_FRACTION } from '@/lib/pool/placement'
import { BufferItems } from '../components/buffer-items'
import { PoolItem } from '../components/pool-item'

interface PageProps {
  stats?: StorageStats
  statsLoading: boolean
}

export function Page({ stats, statsLoading }: PageProps) {
  return (
    <div className="space-y-6">
      <ItemGroup className="gap-2">
        <BufferItems usage={stats?.buffer} isLoading={statsLoading} />
        {stats ? (
          <PoolItem pool={stats.pool} />
        ) : statsLoading ? (
          <Item variant="outline" size="sm">
            <Skeleton className="h-10 w-full" />
          </Item>
        ) : null}
      </ItemGroup>
      {stats && isPoolLow(stats.pool) ? (
        <p className="text-sm text-destructive">
          Free space is below {POOL_LOW_FRACTION * 100}% of the pledge. Recruit
          flamekeepers or schedule albums for deletion.
        </p>
      ) : null}
      <Button variant="outline" asChild>
        <Link to={'/admin/settings/storage' as string}>Storage settings</Link>
      </Button>
    </div>
  )
}
