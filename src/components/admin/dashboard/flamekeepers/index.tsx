import { Link } from '@tanstack/react-router'
import {
  Flame,
  Gauge,
  HardDrive,
  HeartCrack,
  Hourglass,
  PackageCheck,
  PackageOpen,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemGroup } from '@/components/ui/item'
import type { FlamekeeperStats } from '@/lib/admin/dashboard-types'
import { formatGb } from '@/lib/flamekeeper/rules'
import { POOL_LOW_FRACTION } from '@/lib/pool/placement'
import { StatItem } from '../components/stat-item'

interface PageProps {
  stats?: FlamekeeperStats
  statsLoading: boolean
}

export function Page({ stats, statsLoading }: PageProps) {
  const rows: Array<{
    icon: LucideIcon
    label: string
    value?: string
  }> = [
    { icon: Flame, label: 'Active', value: stats?.states.active.toString() },
    { icon: PackageCheck, label: 'Full', value: stats?.states.full.toString() },
    {
      icon: Hourglass,
      label: 'Draining',
      value: stats?.states.draining.toString(),
    },
    { icon: HeartCrack, label: 'Lost', value: stats?.states.lost.toString() },
    {
      icon: PackageOpen,
      label: 'Drained',
      value: stats?.states.drained.toString(),
    },
    {
      icon: HardDrive,
      label: 'Pledged',
      value: stats && formatGb(stats.pledgedBytes),
    },
    { icon: Waves, label: 'Used', value: stats && formatGb(stats.usedBytes) },
    { icon: Waves, label: 'Free', value: stats && formatGb(stats.freeBytes) },
    {
      icon: Gauge,
      label: 'Per-account cap',
      value: stats && formatGb(stats.capBytes),
    },
  ]

  return (
    <div className="space-y-6">
      <ItemGroup className="gap-2">
        {rows.map(({ icon, label, value }) => (
          <StatItem
            key={label}
            icon={icon}
            label={label}
            value={value}
            isLoading={statsLoading}
          />
        ))}
      </ItemGroup>
      {stats?.poolLow ? (
        <p className="text-sm text-destructive">
          Free space is below {POOL_LOW_FRACTION * 100}% of the pledge. Recruit
          flamekeepers or schedule albums for deletion.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/admin/flamekeepers">Flamekeepers</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/settings/flamekeepers">Flamekeeper settings</Link>
        </Button>
      </div>
    </div>
  )
}
