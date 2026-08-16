import { Link, useNavigate } from '@tanstack/react-router'
import { Users, Camera, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { ExportUsersDialog } from '@/components/shared/export-users-dialog'
import { BroadcastDialog } from '@/components/shared/broadcast-dialog'
import { DashboardAlerts } from './components/dashboard-alerts'
import { BookingStatCards } from './components/booking-stat-cards'
import { AlbumStorageCards } from './components/album-storage-cards'
import { AlbumsChart } from './components/albums-chart'
import { MostActiveUsersTable } from './components/most-active-users-table'
import { ViolationsTable } from './components/violations-table'
import type { DashboardSearchParams } from '@/lib/admin/dashboard-queries'
import type {
  AdminDashboardStats,
  DashboardAlert,
  PaginatedMostActiveUsersResponse,
  PaginatedViolationsResponse,
} from '@/lib/admin/dashboard-types'

interface PageProps {
  search: DashboardSearchParams
  stats?: AdminDashboardStats
  alerts: DashboardAlert[]
  mostActive: PaginatedMostActiveUsersResponse
  violations: PaginatedViolationsResponse
  isLoading?: boolean
  canBroadcast?: boolean
}

export function Page({
  search,
  stats,
  alerts,
  mostActive,
  violations,
  isLoading = false,
  canBroadcast = false,
}: PageProps) {
  const navigate = useNavigate()

  const handleRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    navigate({
      to: '.',
      search: {
        ...search,
        startDate: range?.from ? range.from.toISOString() : undefined,
        endDate: range?.to ? range.to.toISOString() : undefined,
        activePage: 1,
        violationPage: 1,
      } as never,
    })
  }

  const resetRange = () => {
    navigate({
      to: '.',
      search: {
        ...search,
        startDate: undefined,
        endDate: undefined,
        activePage: 1,
        violationPage: 1,
      } as never,
    })
  }

  const hasCustomRange = Boolean(search.startDate || search.endDate)

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Monitor bookings, album storage, user activity, and club health"
      />

      <div className="space-y-8">
        <Section title="Quick Actions">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/admin/users">
                <Users className="mr-2 h-4 w-4" />
                View All Users
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/admin/equipment/new">
                <Camera className="mr-2 h-4 w-4" />
                Add Equipment
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/admin/bookings">
                <Calendar className="mr-2 h-4 w-4" />
                View All Bookings
              </Link>
            </Button>
            <ExportUsersDialog className="w-full sm:w-auto" />
            {canBroadcast && <BroadcastDialog className="w-full sm:w-auto" />}
          </div>
        </Section>

        <Section
          title="Alerts"
          description="Current items that need attention."
        >
          <DashboardAlerts alerts={alerts} isLoading={isLoading} />
        </Section>

        <Section
          title="Overview"
          description="Booking activity, album creation, and storage in the selected range."
          actions={
            <div className="flex items-center gap-2">
              {hasCustomRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={resetRange}
                >
                  Reset range
                </Button>
              )}
              <DateRangeFilter
                from={search.startDate}
                to={search.endDate}
                onChange={handleRangeChange}
              />
            </div>
          }
        >
          <div className="space-y-4">
            <BookingStatCards
              stats={stats?.bookingStats}
              isLoading={isLoading}
            />
            <AlbumStorageCards
              stats={stats?.albumStorage}
              isLoading={isLoading}
            />
          </div>
        </Section>

        <Section>
          <AlbumsChart
            data={stats?.albumsPerMonth ?? []}
            isLoading={isLoading}
          />
        </Section>

        <Section
          title="Most Active Users"
          description="Users with the most albums (owned or co-authored) in the selected range."
        >
          <MostActiveUsersTable
            users={mostActive.users}
            pagination={mostActive.pagination}
            filters={{
              startDate: search.startDate,
              endDate: search.endDate,
              search: search.activeSearch,
              page: search.activePage ?? 1,
              limit: search.activeLimit ?? 10,
              sortBy: search.activeSortBy ?? 'albumCount',
              sortOrder: search.activeSortOrder ?? 'desc',
            }}
            search={search}
            isLoading={isLoading}
          />
        </Section>

        <Section
          title="Violations"
          description="All-time auto-cancelled and overdue counters per user."
        >
          <ViolationsTable
            users={violations.users}
            pagination={violations.pagination}
            filters={{
              violationType: search.violationType,
              search: search.violationSearch,
              page: search.violationPage ?? 1,
              limit: search.violationLimit ?? 10,
              sortBy: search.violationSortBy ?? 'cancelledInStartWindowCount',
              sortOrder: search.violationSortOrder ?? 'desc',
            }}
            search={search}
            isLoading={isLoading}
          />
        </Section>
      </div>
    </PageContainer>
  )
}
