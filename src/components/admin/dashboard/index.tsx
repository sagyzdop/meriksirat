import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import type { DashboardAlert } from '@/lib/admin/dashboard-types'
import { DashboardHeaderActions } from './components/header-actions'

interface PageProps {
  alerts: DashboardAlert[]
  alertsLoading: boolean
  canBroadcast: boolean
  children: ReactNode
}

const tabs = [
  { value: 'bookings', label: 'Bookings', to: '/admin/dashboard/bookings' },
  { value: 'albums', label: 'Albums', to: '/admin/dashboard/albums' },
  { value: 'members', label: 'Members', to: '/admin/dashboard/members' },
  {
    value: 'flamekeepers',
    label: 'Flamekeepers',
    to: '/admin/dashboard/flamekeepers',
  },
  { value: 'storage', label: 'Storage', to: '/admin/dashboard/storage' },
] as const

export function Page({
  alerts,
  alertsLoading,
  canBroadcast,
  children,
}: PageProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const active =
    tabs.find((tab) => pathname.startsWith(tab.to))?.value ?? 'bookings'

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        actions={
          <DashboardHeaderActions
            alerts={alerts}
            alertsLoading={alertsLoading}
            canBroadcast={canBroadcast}
          />
        }
      />

      <div className="max-w-2xl space-y-6">
        <Tabs value={active}>
          <TabsList variant="line" className="max-w-full overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Link to={tab.to}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {children}
      </div>
    </PageContainer>
  )
}
