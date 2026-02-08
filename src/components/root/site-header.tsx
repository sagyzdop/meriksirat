import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useLocation } from '@tanstack/react-router'

export function SiteHeader() {
  const location = useLocation()
  const pathname = location.pathname

  // Get current page name based on pathname
  const getPageName = () => {
    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'equipment')) {
      return 'Equipment'
    }

    const section = segments[0]

    switch (section) {
      case 'bookings':
        if (segments.length === 1) return 'My Bookings'
        if (segments[1] === 'new') return 'New Booking'
        if (segments[1] === 'edit') return 'Edit Booking'
        return 'Booking Details'

      case 'equipment':
        if (segments.length === 1) return 'Equipment'
        return 'Equipment Details'

      case 'admin':
        if (segments.length === 1) return 'Admin'
        if (segments[1] === 'dashboard') return 'Admin Dashboard'
        if (segments[1] === 'users') return 'User Management'
        if (segments[1] === 'equipment') return 'Equipment Management'
        if (segments[1] === 'categories') return 'Category Management'
        if (segments[1] === 'bookings') return 'Booking Oversight'
        if (segments[1] === 'settings') return 'Admin Settings'
        return 'Admin'

      case 'profile':
        return 'My Profile'

      case 'faq':
        return 'FAQ'

      case 'dashboard':
        return 'Dashboard'

      default:
        return section.charAt(0).toUpperCase() + section.slice(1)
    }
  }

  const pageName = getPageName()

  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageName}</h1>
      </div>
    </header>
  )
}
