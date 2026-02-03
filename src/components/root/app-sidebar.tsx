import * as React from 'react'
import {
  HelpCircle,
  Layers,
  Settings,
  Camera,
  ShieldCheck,
  Users,
  Tags,
  Calendar
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { getSessionFn } from '@/lib/auth/session'
import { Link, useRouter } from '@tanstack/react-router'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import { NavSecondary } from './nav-secondary'

const data = {
  navMain: [
    {
      title: 'Equipment Booking',
      url: '/equipment',
      icon: Camera,
    },
    {
      title: 'My Bookings',
      url: '/bookings',
      icon: Calendar,
    },
  ],
  navSecondary: [
    {
      title: 'FAQ',
      url: '/faq',
      icon: HelpCircle,
    },
  ],
  navAdmin: [
    {
      title: 'Admin Dashboard',
      url: '/admin/dashboard',
      icon: ShieldCheck,
    },
    {
      title: 'User Management',
      url: '/admin/users',
      icon: Users,
    },
    {
      title: 'Equipment Management',
      url: '/admin/equipment',
      icon: Camera,
    },
    {
      title: 'Category Management',
      url: '/admin/categories',
      icon: Tags,
    },
    {
      title: 'Booking Oversight',
      url: '/admin/bookings',
      icon: Calendar,
    },
    {
      title: 'Admin Settings',
      url: '/admin/settings',
      icon: Settings,
    },
  ],
}

export function AppSidebar({ user: userData, onLogout, ...props }: React.ComponentProps<typeof Sidebar> & { 
  user?: any;
  onLogout?: () => void;
}) {
  const [user, setUser] = React.useState<{
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null>(null);

  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()

  React.useEffect(() => {
    getSessionFn().then(session => {
      setUser(session?.user || null);
    });
  }, []);

  // Close mobile sidebar on navigation
  React.useEffect(() => {
    if (!isMobile) return
    
    const unsubscribe = router.subscribe('onBeforeLoad', () => {
      setOpenMobile(false)
    })
    
    return unsubscribe
  }, [isMobile, router, setOpenMobile])

  const displayUser = userData ? {
    name: [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email,
    email: userData.email,
    avatar: userData.image || user?.image || '/avatars/default.jpg',
  } : {
    name: 'Loading...',
    email: '',
    avatar: '/avatars/default.jpg',
  };

  // Check if user has admin privileges
  const hasAdminAccess = userData?.role === 'admin' || userData?.role === 'manager';

  return (
    <Sidebar collapsible="offcanvas" {...props} aria-label="Main navigation sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              aria-label="Go to equipment page">
              <Link to="/equipment">
                <Layers className="size-5!" aria-hidden="true" />
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
        <div className="mt-auto">
          <div className="px-4 py-2 text-xs text-muted-foreground">
            Made by <a href="https://sagyzdop.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">sagyzdop</a>
          </div>
          <NavSecondary items={data.navSecondary} />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
