// src/routes/_authenticated.tsx
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { getSessionFn } from '@/lib/session'
import { authClient } from '@/lib/auth-client'
import { AppSidebar } from '@/components/root/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SiteHeader } from '@/components/root/site-header'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSessionFn()

    if (!session?.user) {
      throw redirect({ to: '/login' })
    }

    return { session }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    router.invalidate()
    router.navigate({ to: '/login' })
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader onLogout={handleLogout} />
        <div className="px-4 py-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
