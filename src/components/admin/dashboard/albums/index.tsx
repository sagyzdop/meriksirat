import { Link } from '@tanstack/react-router'
import { FolderOpen, HardDrive, Images, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemGroup } from '@/components/ui/item'
import type {
  AdminDashboardRange,
  AlbumStorageStats,
} from '@/lib/admin/dashboard-types'
import { formatBytes } from '@/lib/format'
import { RangeBar } from '../components/range-bar'
import { StatItem } from '../components/stat-item'

interface PageProps {
  search: AdminDashboardRange
  onRangeChange: (range: AdminDashboardRange) => void
  stats?: AlbumStorageStats
  statsLoading: boolean
}

const albumStats: Array<{
  key: keyof AlbumStorageStats
  label: string
  icon: LucideIcon
  format: (value: number) => string
}> = [
  {
    key: 'albumCount',
    label: 'Albums',
    icon: FolderOpen,
    format: (value) => value.toLocaleString(),
  },
  {
    key: 'photoCount',
    label: 'Photos',
    icon: Images,
    format: (value) => value.toLocaleString(),
  },
  {
    key: 'totalBytes',
    label: 'Storage Used',
    icon: HardDrive,
    format: formatBytes,
  },
]

export function Page({
  search,
  onRangeChange,
  stats,
  statsLoading,
}: PageProps) {
  return (
    <div className="space-y-6">
      <RangeBar search={search} onChange={onRangeChange} />
      <ItemGroup className="gap-2">
        {albumStats.map(({ key, label, icon, format }) => (
          <StatItem
            key={key}
            icon={icon}
            label={label}
            value={stats ? format(stats[key]) : undefined}
            isLoading={statsLoading}
          />
        ))}
      </ItemGroup>
      <Button variant="outline" asChild>
        <Link to="/admin/albums">Album Management</Link>
      </Button>
    </div>
  )
}
