import * as React from 'react'
import {
  IconHelp,
  IconInnerShadowTop,
  IconSettings,
  IconCamera,
  IconShield,
  IconUsers,
  IconTags,
  IconCalendar
} from '@tabler/icons-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { getSessionFn } from '@/lib/auth/session'
import { getUserFn } from '@/lib/user'
import { Link } from '@tanstack/react-router'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import { NavSecondary } from './nav-secondary'

const data = {
  navMain: [
    {
      title: 'Equipment Booking',
      url: '/equipment',
      icon: IconCamera,
    },
    {
      title: 'My Bookings',
      url: '/bookings',
      icon: IconCamera,
    },
  ],
  navSecondary: [
    {
      title: 'FAQ',
      url: '/faq',
      icon: IconHelp,
    },
  ],
  navAdmin: [
    {
      title: 'Admin Dashboard',
      url: '/admin/dashboard',
      icon: IconShield,
    },
    {
      title: 'User Management',
      url: '/admin/users',
      icon: IconUsers,
    },
    {
      title: 'Equipment Management',
      url: '/admin/equipment',
      icon: IconCamera,
    },
    {
      title: 'Category Management',
      url: '/admin/categories',
      icon: IconTags,
    },
    {
      title: 'Booking Oversight',
      url: '/admin/bookings',
      icon: IconCalendar,
    },
    {
      title: 'Admin Settings',
      url: '/admin/settings',
      icon: IconSettings,
    },
  ],
}

export function AppSidebar({ onLogout, ...props }: React.ComponentProps<typeof Sidebar> & { onLogout?: () => void }) {
  const [user, setUser] = React.useState<{
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null>(null);
  const [userData, setUserData] = React.useState<{
    id: string;
    name: string;
    email: string;
    role: 'user' | 'manager' | 'admin' | null;
    clearanceLevel: number | null;
    status: string | null;
    onboardingComplete: boolean | null;
  } | null>(null);

  React.useEffect(() => {
    getSessionFn().then(session => {
      setUser(session?.user || null);
    });
    
    getUserFn().then(userData => {
      setUserData(userData || null);
    });
  }, []);

  const displayUser = user ? {
    name: user.name,
    email: user.email,
    avatar: user.image || '/avatars/default.jpg',
  } : {
    name: 'Loading...',
    email: '',
    avatar: '/avatars/default.jpg',
  };

  // Check if user has admin privileges
  const hasAdminAccess = userData?.role === 'admin' || userData?.role === 'manager';

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link to="/equipment">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">MerikSirat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {hasAdminAccess && (
          <NavSecondary items={data.navAdmin} />
        )}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
