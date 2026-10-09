import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { BookingStatCards } from './components/booking-stat-cards'
import { AlbumStorageCards } from './components/album-storage-cards'
import { DashboardHeaderActions } from './components/header-actions'
import { MostActiveUsersTable } from './components/most-active-users-table'
import { ViolationsTable } from './components/violations-table'
import { SettingsTab, SettingsTabSkeleton } from './components/settings-tab'
import { effectiveDashboardRange } from '@/lib/admin/dashboard-queries'
import type {
  DashboardSearchParams,
  DashboardTab,
} from '@/lib/admin/dashboard-queries'
import type {
  AdminDashboardStats,
  DashboardAlert,
  PaginatedMostActiveUsersResponse,
  PaginatedViolationsResponse,
} from '@/lib/admin/dashboard-types'
import type { SettingsData } from '@/lib/admin/functions/settings'

interface PageProps {
  search: DashboardSearchParams
  tab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  stats?: AdminDashboardStats
  statsLoading: boolean
  alerts: DashboardAlert[]
  alertsLoading: boolean
  mostActive: PaginatedMostActiveUsersResponse
  mostActiveLoading: boolean
  violations: PaginatedViolationsResponse
  violationsLoading: boolean
  settings?: SettingsData
  settingsLoading: boolean
  canBroadcast: boolean
}

export function Page({
  search,
  tab,
  onTabChange,
  stats,
  statsLoading,
  alerts,
  alertsLoading,
  mostActive,
  mostActiveLoading,
  violations,
  violationsLoading,
  settings,
  settingsLoading,
  canBroadcast,
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

  // Default (no custom range) = the current month. Surfacing the resolved
  // range in the picker keeps the label and calendar selection in sync with
  // what the dashboard is actually showing.
  const effectiveRange = effectiveDashboardRange({
    startDate: search.startDate,
    endDate: search.endDate,
  })

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Monitor bookings, album storage, user activity, and club health"
        actions={
          <DashboardHeaderActions
            alerts={alerts}
            alertsLoading={alertsLoading}
            canBroadcast={canBroadcast}
          />
        }
      />

      <div className="space-y-6">
        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as DashboardTab)}
          className="gap-4"
        >
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="albums">Albums</TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
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
              <BookingStatCards
                stats={stats?.bookingStats}
                isLoading={statsLoading}
              />
              <AlbumStorageCards
                stats={stats?.albumStorage}
                isLoading={statsLoading}
              />
            </div>
          </TabsContent>

          <TabsContent value="albums">
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
              isLoading={mostActiveLoading}
            />
          </TabsContent>

          <TabsContent value="violations">
            <div className="space-y-4">
              <ViolationsTable
                users={violations.users}
                pagination={violations.pagination}
                filters={{
                  violationType: search.violationType,
                  search: search.violationSearch,
                  page: search.violationPage ?? 1,
                  limit: search.violationLimit ?? 10,
                  sortBy:
                    search.violationSortBy ?? 'cancelledInStartWindowCount',
                  sortOrder: search.violationSortOrder ?? 'desc',
                }}
                search={search}
                isLoading={violationsLoading}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              {settings ? (
                <SettingsTab settings={settings} />
              ) : settingsLoading ? (
                <SettingsTabSkeleton />
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
