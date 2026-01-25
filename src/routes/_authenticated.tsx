// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { getSessionFn } from "@/lib/session"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const session = await getSessionFn()
    
    if (!session?.user) {
      throw redirect({ to: "/login" })
    }
    
    return { session }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}