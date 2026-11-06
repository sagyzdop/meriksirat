import { useNavigate } from '@tanstack/react-router'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  FolderOpen,
  HardDrive,
  Images,
  TimerReset,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { formatBytes } from '@/lib/format'
import { effectiveDashboardRange } from '@/lib/admin/dashboard-queries'
import type {
  AdminDashboardRange,
  AdminDashboardStats,
  BookingStats,
  DashboardAlert,
} from '@/lib/admin/dashboard-types'
import { DashboardHeaderActions } from './components/header-actions'

interface PageProps {
  search: AdminDashboardRange
  tab: 'bookings' | 'albums'
  stats?: AdminDashboardStats
  statsLoading: boolean
  alerts: DashboardAlert[]
  alertsLoading: boolean
  canBroadcast: boolean
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

const albumStats: Array<{
  key: 'albumCount' | 'photoCount' | 'totalBytes'
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

function StatItem({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: LucideIcon
  label: string
  value?: string
  isLoading: boolean
}) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
      </ItemContent>
      {isLoading && value === undefined ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <ItemDescription className="font-semibold tabular-nums text-foreground">
          {value}
        </ItemDescription>
      )}
    </Item>
  )
}

export function Page({
  search,
  tab,
  stats,
  statsLoading,
  alerts,
  alertsLoading,
  canBroadcast,
}: PageProps) {
  const navigate = useNavigate()

  const handleTabChange = (value: string) => {
    navigate({ to: '.', search: { ...search, tab: value } as never })
  }

  const handleRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    navigate({
      to: '.',
      search: {
        ...search,
        startDate: range?.from ? range.from.toISOString() : undefined,
        endDate: range?.to ? range.to.toISOString() : undefined,
      } as never,
    })
  }

  const resetRange = () => {
    navigate({
      to: '.',
      search: { ...search, startDate: undefined, endDate: undefined } as never,
    })
  }

  const hasCustomRange = Boolean(search.startDate || search.endDate)
  const effectiveRange = effectiveDashboardRange(search)

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Bookings and album storage for the selected range"
        actions={
          <DashboardHeaderActions
            alerts={alerts}
            alertsLoading={alertsLoading}
            canBroadcast={canBroadcast}
          />
        }
      />

      <div className="max-w-2xl space-y-10">
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-end">
          {hasCustomRange && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-muted-foreground md:w-auto"
              onClick={resetRange}
            >
              Reset range
            </Button>
          )}
          <DateRangeFilter
            from={effectiveRange.startDate}
            to={effectiveRange.endDate}
            onChange={handleRangeChange}
            className="w-full md:w-auto"
          />
        </div>

        <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
          <TabsList variant="line">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="albums">Albums</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <ItemGroup className="gap-2">
              {bookingStats.map(({ key, label, icon }) => (
                <StatItem
                  key={key}
                  icon={icon}
                  label={label}
                  value={stats?.bookingStats[key].toLocaleString()}
                  isLoading={statsLoading}
                />
              ))}
            </ItemGroup>
          </TabsContent>

          <TabsContent value="albums">
            <ItemGroup className="gap-2">
              {albumStats.map(({ key, label, icon, format }) => (
                <StatItem
                  key={key}
                  icon={icon}
                  label={label}
                  value={stats ? format(stats.albumStorage[key]) : undefined}
                  isLoading={statsLoading}
                />
              ))}
            </ItemGroup>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
