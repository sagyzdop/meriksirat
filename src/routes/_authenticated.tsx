// src/routes/_authenticated.tsx
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { getUserFn } from '@/lib/user'
import { authClient } from '@/lib/auth/auth-client'
import { AppSidebar } from '@/components/root/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SiteHeader } from '@/components/root/site-header'
import { Toaster } from '@/components/ui/sonner'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const user = await getUserFn()

    if (!user) {
      throw redirect({ to: '/login' })
    }

    if (!user.onboardingComplete) {
      throw redirect({ to: '/onboarding' })
    }

    return { user }
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
      <AppSidebar onLogout={handleLogout} />
      <SidebarInset>
        <SiteHeader onLogout={handleLogout} />
        <div className="flex flex-col flex-1 px-4 py-8">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}
