import { Link, useLocation } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface AdminTab {
  label: string
  to: LinkProps['to'] & string
}

export const memberTabs: AdminTab[] = [
  { label: 'Members', to: '/admin/members' },
  { label: 'Birthdays', to: '/admin/members/birthdays' },
  { label: 'Violations', to: '/admin/members/violations' },
]

export const equipmentTabs: AdminTab[] = [
  { label: 'Equipment', to: '/admin/equipment' },
  { label: 'Categories', to: '/admin/equipment/categories' },
]

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/$/, ''),
  })
  const active = tabs.find((tab) => tab.to === pathname)?.to ?? tabs[0].to

  return (
    <Tabs value={active} className="mb-6">
      <TabsList variant="line" className="max-w-full overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.to} value={tab.to} asChild>
            <Link to={tab.to}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
