import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavSecondary({
  title,
  items,
  ...props
}: {
  title?: string
  items: {
    title: string
    url: string
    icon: LucideIcon
    external?: boolean
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                {item.external ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Navigate to ${item.title}`}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.title}</span>
                  </a>
                ) : (
                  <Link to={item.url} aria-label={`Navigate to ${item.title}`}>
                    <item.icon aria-hidden="true" />
                    <span>{item.title}</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
