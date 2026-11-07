import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'members', label: 'Members', to: '/admin/settings/members' },
  { value: 'bookings', label: 'Bookings', to: '/admin/settings/bookings' },
  { value: 'albums', label: 'Albums', to: '/admin/settings/albums' },
  { value: 'storage', label: 'Storage', to: '/admin/settings/storage' },
  {
    value: 'flamekeepers',
    label: 'Flamekeepers',
    to: '/admin/settings/flamekeepers',
  },
] as const

export function Page({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const active = pathname.split('/').filter(Boolean).pop() ?? 'members'

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Members, bookings, albums, storage and flamekeepers"
      />
      <Tabs value={active} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Link to={tab.to}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="max-w-2xl space-y-6">{children}</div>
    </PageContainer>
  )
}
