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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { BookingStats } from '@/lib/admin/dashboard-types'
import { cn } from '@/lib/utils'

interface StatCardDef {
  key: keyof BookingStats
  label: string
  icon: LucideIcon
  accent: string
  iconClass: string
}

const statCards: StatCardDef[] = [
  {
    key: 'total',
    label: 'Total',
    icon: CalendarDays,
    accent: 'bg-slate-100 dark:bg-slate-900/40',
    iconClass: 'text-slate-600 dark:text-slate-400',
  },
  {
    key: 'booked',
    label: 'Booked',
    icon: CalendarPlus,
    accent: 'bg-blue-100 dark:bg-blue-900/20',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'active',
    label: 'Active',
    icon: CalendarCheck2,
    accent: 'bg-green-100 dark:bg-green-900/20',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  {
    key: 'overdue',
    label: 'Overdue',
    icon: TimerReset,
    accent: 'bg-red-100 dark:bg-red-900/20',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  {
    key: 'returned',
    label: 'Returned',
    icon: CalendarClock,
    accent: 'bg-teal-100 dark:bg-teal-900/20',
    iconClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: CalendarX,
    accent: 'bg-zinc-100 dark:bg-zinc-900/40',
    iconClass: 'text-zinc-600 dark:text-zinc-400',
  },
  {
    key: 'partially_returned',
    label: 'Partially Returned',
    icon: CalendarOff,
    accent: 'bg-amber-100 dark:bg-amber-900/20',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
]

interface BookingStatCardsProps {
  stats?: BookingStats
  isLoading?: boolean
}

export function BookingStatCards({
  stats,
  isLoading = false,
}: BookingStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {statCards.map((card) => {
        const Icon = card.icon
        const value = stats?.[card.key]
        return (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && value === undefined ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      card.accent
                    )}
                  >
                    <Icon className={cn('h-4 w-4', card.iconClass)} />
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {(value ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
