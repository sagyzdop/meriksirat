import { Link } from '@tanstack/react-router'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  TimerReset,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemGroup } from '@/components/ui/item'
import type {
  AdminDashboardRange,
  BookingStats,
} from '@/lib/admin/dashboard-types'
import { RangeBar } from '../components/range-bar'
import { StatItem } from '../components/stat-item'

interface PageProps {
  search: AdminDashboardRange
  onRangeChange: (range: AdminDashboardRange) => void
  stats?: BookingStats
  statsLoading: boolean
}

const bookingStats: Array<{
  key: keyof BookingStats
  label: string
  icon: LucideIcon
}> = [
  { key: 'total', label: 'Total', icon: CalendarDays },
  { key: 'booked', label: 'Booked', icon: CalendarPlus },
  { key: 'active', label: 'Active', icon: CalendarCheck2 },
  { key: 'overdue', label: 'Overdue', icon: TimerReset },
  { key: 'returned', label: 'Returned', icon: CalendarClock },
  { key: 'cancelled', label: 'Cancelled', icon: CalendarX },
  { key: 'partially_returned', label: 'Partially Returned', icon: CalendarOff },
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
        {bookingStats.map(({ key, label, icon }) => (
          <StatItem
            key={key}
            icon={icon}
            label={label}
            value={stats?.[key].toLocaleString()}
            isLoading={statsLoading}
          />
        ))}
      </ItemGroup>
      <Button variant="outline" asChild>
        <Link to="/admin/bookings">Booking Oversight</Link>
      </Button>
    </div>
  )
}
