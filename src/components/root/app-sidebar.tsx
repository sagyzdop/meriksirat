import * as React from 'react'
import {
  Info,
  Layers,
  Camera,
  Flame,
  ShieldCheck,
  Users,
  Tags,
  Calendar,
  Images,
  FolderOpen,
  Heart,
  Cake,
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
import { authClient } from '@/lib/auth/auth-client'
import { ALBUM_CREATE_MIN_CLEARANCE } from '@/lib/albums'
import { EQUIPMENT_MIN_CLEARANCE } from '@/lib/equipment'
import { Link, useRouter } from '@tanstack/react-router'
import { NavMain } from './nav-main'
import { NavUser } from './nav-user'
import { NavSecondary } from './nav-secondary'

const data = {
  navGroups: [
    {
      title: 'Bookings',
      items: [
        {
          title: 'Equipment Booking',
          url: '/equipment',
          icon: Camera,
          requires: 'equipment' as 'albums' | 'equipment' | undefined,
        },
        {
          title: 'My Bookings',
          url: '/bookings',
          icon: Calendar,
        },
      ],
    },
    {
      title: 'Albums',
      items: [
        {
          title: 'All Public Albums',
          url: '/albums',
          icon: Images,
        },
        {
          title: 'My Albums',
          url: '/my-albums',
          icon: FolderOpen,
          requires: 'albums' as 'albums' | 'equipment' | undefined,
        },
        {
          title: 'My Favorites',
          url: '/favorites',
          icon: Heart,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'About',
      url: '/about',
      icon: Info,
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
      title: 'Flamekeepers',
      url: '/admin/flamekeepers',
      icon: Flame,
    },
    {
      title: 'Birthdays',
      url: '/admin/birthdays',
      icon: Cake,
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
      title: 'Album Management',
      url: '/admin/albums',
      icon: Images,
    },
  ],
}

export function AppSidebar({
  user: userData,
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    id: string
    name: string | null
    email: string
    image?: string | null
    firstName?: string | null
    lastName?: string | null
    role?: string | null
    clearanceLevel?: number | null
    isMember: boolean
  }
  onLogout?: () => void
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()

  // Reuses better-auth's shared client session store instead of issuing a
  // second /api/auth/get-session request alongside other useSession consumers.
  const { data: session } = authClient.useSession()

  // Close mobile sidebar on navigation
  React.useEffect(() => {
    if (!isMobile) return

    const unsubscribe = router.subscribe('onBeforeLoad', () => {
      setOpenMobile(false)
    })

    return unsubscribe
  }, [isMobile, router, setOpenMobile])

  const displayUser = {
    name:
      [userData.firstName, userData.lastName].filter(Boolean).join(' ') ||
      userData.email,
    email: userData.email,
    avatar: userData.image || session?.user?.image || '/avatars/default.jpg',
  }

  const hasAdminAccess =
    userData.role === 'admin' || userData.role === 'manager'

  const canUseAlbums =
    (userData.clearanceLevel ?? 0) >= ALBUM_CREATE_MIN_CLEARANCE

  const canUseEquipment =
    (userData.clearanceLevel ?? 0) >= EQUIPMENT_MIN_CLEARANCE

  const isMember = userData.isMember

  const navGroups = React.useMemo(() => {
    const allowed = { albums: canUseAlbums, equipment: canUseEquipment }
    const disabledReason = {
      albums: `Album creation and management require clearance level ${ALBUM_CREATE_MIN_CLEARANCE}. Contact an admin to request access.`,
      equipment: `Equipment booking requires clearance level ${EQUIPMENT_MIN_CLEARANCE} or higher. Contact an admin to request access.`,
    }
    const groups = isMember
      ? data.navGroups
      : [
          {
            title: 'Albums',
            items: data.navGroups[1].items.filter(
              (item) => item.url === '/albums' || item.url === '/favorites'
            ),
          },
        ]
    return groups.map((group) => ({
      ...group,
      items: group.items.map(({ requires, ...item }) =>
        !requires || allowed[requires]
          ? item
          : {
              ...item,
              disabled: true,
              disabledReason: disabledReason[requires],
            }
      ),
    }))
  }, [canUseAlbums, canUseEquipment, isMember])

  return (
    <Sidebar
      collapsible="offcanvas"
      {...props}
      aria-label="Main navigation sidebar"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              aria-label="Go to equipment page"
            >
              <Link to="/equipment">
                <Layers className="size-5!" aria-hidden="true" />
                <span className="text-base font-semibold">MerikSirat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} />
        {hasAdminAccess && <NavSecondary title="Admin" items={data.navAdmin} />}
        <div className="mt-auto">
          <div className="px-4 py-2 text-xs text-muted-foreground">
            Made by{' '}
            <a
              href="https://sagyzdop.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              sagyzdop
            </a>
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
