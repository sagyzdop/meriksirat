import { useRouter } from '@tanstack/react-router'
import { authClient } from '@/lib/auth/auth-client'
import type { UserProfile } from '@/lib/user'
import { AppSidebar } from './app-sidebar'
import { SiteHeader } from './site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { BirthdayWishDrawer } from '@/components/shared/birthday-wish-drawer'

interface AuthenticatedShellProps {
  user: UserProfile
  children: React.ReactNode
}

/**
 * The logged-in app shell: sidebar + site header + page content. Used by the
 * `_authenticated` layout and by public routes that still want the shell when
 * a session is present (e.g. the public albums gallery).
 */
export function AuthenticatedShell({
  user,
  children,
}: AuthenticatedShellProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    router.invalidate()
    router.navigate({ to: '/login' })
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} onLogout={handleLogout} />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <div className="flex flex-1 min-w-0 flex-col">{children}</div>
      </SidebarInset>
      <Toaster />
      <BirthdayWishDrawer />
    </SidebarProvider>
  )
}
