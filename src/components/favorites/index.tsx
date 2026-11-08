import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'

interface PageProps {
  children: ReactNode
}

const tabs = [
  { value: 'photos', label: 'Photos', to: '/favorites/photos' },
  { value: 'albums', label: 'Albums', to: '/favorites/albums' },
] as const

export function Page({ children }: PageProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const active =
    tabs.find((tab) => pathname.startsWith(tab.to))?.value ?? 'photos'

  return (
    <PageContainer>
      <PageHeader
        title="My favorites"
        description="Photos and albums you saved."
      />
      <div className="space-y-6">
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
