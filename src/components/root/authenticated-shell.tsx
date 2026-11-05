import { useLogout } from '@/hooks/use-logout'
import type { UserProfile } from '@/lib/user'
import { AppSidebar } from './app-sidebar'
import { SiteHeader } from './site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { FlamekeeperBanner } from '@/components/shared/flamekeeper-banner'
import { FlamekeeperInvitation } from '@/components/shared/flamekeeper-invitation'
import { PublicAlbumsLayout } from '@/components/albums/public-layout'
import { BirthdayWishDrawer } from '@/components/shared/birthday-wish-drawer'

interface AuthenticatedShellProps {
  user: UserProfile
  children: React.ReactNode
}

/**
 * The logged-in app shell: sidebar + site header + page content for members;
 * the public header and footer for everyone else. Used by the
 * `_authenticated` layout and by public routes that still want the shell when
 * a session is present (e.g. the public albums gallery).
 */
export function AuthenticatedShell({
  user,
  children,
}: AuthenticatedShellProps) {
  const handleLogout = useLogout()

  if (!user.isMember) {
    return (
      <PublicAlbumsLayout user={user}>
        <FlamekeeperBanner email={user.email} />
        {children}
      </PublicAlbumsLayout>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} onLogout={handleLogout} />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <FlamekeeperBanner email={user.email} />
        <div className="flex flex-1 min-w-0 flex-col">{children}</div>
      </SidebarInset>
      <Toaster />
      <BirthdayWishDrawer userId={user.id} />
      <FlamekeeperInvitation
        user={{
          ...user,
          role: (user.role as 'user' | 'manager' | 'admin' | null) ?? null,
        }}
      />
    </SidebarProvider>
  )
}
