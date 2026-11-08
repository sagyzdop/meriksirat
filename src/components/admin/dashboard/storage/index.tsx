import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ItemGroup } from '@/components/ui/item'
import { BufferUsage, PoolUsage } from '@/components/shared/storage-usage'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import type { StorageStats } from '@/lib/admin/dashboard-types'

interface PageProps {
  stats?: StorageStats
  statsLoading: boolean
}

export function Page({ stats, statsLoading }: PageProps) {
  const { data: settings } = useQuery(adminDashboardQueries.settings())

  return (
    <div className="space-y-4">
      <ItemGroup className="gap-2">
        <BufferUsage
          usage={stats?.buffer}
          isLoading={statsLoading}
          alertPercent={settings?.bufferAlertPercent}
        />
        <PoolUsage pool={stats?.pool} isLoading={statsLoading} />
      </ItemGroup>

      <Button variant="outline" asChild>
        <Link to="/admin/settings/storage">Storage settings</Link>
      </Button>
    </div>
  )
}
