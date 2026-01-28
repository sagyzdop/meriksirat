import * as React from 'react'
import {
  IconDashboard,
  IconHelp,
  IconInnerShadowTop,
  IconSettings,
  IconCamera
} from '@tabler/icons-react'

import { NavMain } from '@/components/dashboard/nav-main'
import { NavSecondary } from '@/components/dashboard/nav-secondary'
import { NavUser } from '@/components/dashboard/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { getSessionFn } from '@/lib/session'
import { Link } from '@tanstack/react-router'

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: IconDashboard,
    },
    {
      title: 'Equipment',
      url: '/equipment',
      icon: IconCamera,
    },
    {
      title: 'My Bookings',
      url: '/my-bookings',
      icon: IconCamera,
    },
  ],
  navSecondary: [
    {
      title: 'Profile',
      url: '/profile',
      icon: IconSettings,
    },
    {
      title: 'FAQ',
      url: '/faq',
      icon: IconHelp,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<{
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null>(null);

  React.useEffect(() => {
    getSessionFn().then(session => {
      setUser(session?.user || null);
    });
  }, []);

  const userData = user ? {
    name: user.name,
    email: user.email,
    avatar: user.image || '/avatars/default.jpg',
  } : {
    name: 'Loading...',
    email: '',
    avatar: '/avatars/default.jpg',
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/my-bookings">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">MerikSirat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
