import { type LucideIcon, Lock } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  disabled?: boolean
  disabledReason?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export function NavMain({ groups }: { groups: NavGroup[] }) {
  return (
    <>
      {groups.map((group) => {
        const disabledItems = group.items.filter((item) => item.disabled)
        return (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-2">
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.disabled ? (
                      <SidebarMenuButton
                        disabled
                        title={item.disabledReason}
                        aria-label={item.title}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                        <Lock
                          className="ml-auto text-muted-foreground"
                          aria-hidden="true"
                        />
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.url}
                          aria-label={`Navigate to ${item.title}`}
                        >
                          <item.icon aria-hidden="true" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              {disabledItems.length > 0 && (
                <p className="px-2 text-xs text-muted-foreground">
                  {disabledItems[0].disabledReason}
                </p>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}
