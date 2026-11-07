import { Link } from '@tanstack/react-router'
import {
  MessageCircleOff,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemGroup } from '@/components/ui/item'
import type { MemberStats } from '@/lib/admin/dashboard-types'
import { StatItem } from '../components/stat-item'

interface PageProps {
  stats?: MemberStats
  statsLoading: boolean
}

export function Page({ stats, statsLoading }: PageProps) {
  const rows: Array<{
    icon: LucideIcon
    label: string
    value?: number
  }> = [
    { icon: Users, label: 'Total members', value: stats?.total },
    { icon: UserPlus, label: 'New this month', value: stats?.newThisMonth },
    {
      icon: UserX,
      label: 'Onboarding incomplete',
      value: stats?.onboardingIncomplete,
    },
    {
      icon: MessageCircleOff,
      label: 'Telegram unlinked',
      value: stats?.telegramUnlinked,
    },
    { icon: UserCheck, label: 'Members', value: stats?.roles.user },
    { icon: ShieldCheck, label: 'Managers', value: stats?.roles.manager },
    { icon: ShieldCheck, label: 'Admins', value: stats?.roles.admin },
  ]

  return (
    <div className="space-y-6">
      <ItemGroup className="gap-2">
        {rows.map(({ icon, label, value }) => (
          <StatItem
            key={label}
            icon={icon}
            label={label}
            value={value?.toLocaleString()}
            isLoading={statsLoading}
          />
        ))}
        {stats?.clearance.map(({ level, count }) => (
          <StatItem
            key={`clearance-${level}`}
            icon={ShieldCheck}
            label={`Clearance level ${level}`}
            value={count.toLocaleString()}
            isLoading={false}
          />
        ))}
      </ItemGroup>
      <Button variant="outline" asChild>
        <Link to="/admin/users">Member Management</Link>
      </Button>
    </div>
  )
}
