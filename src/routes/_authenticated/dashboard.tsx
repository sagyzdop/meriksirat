// src/routes/_authenticated/dashboard.tsx
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
})

function Dashboard() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  
  const handleLogout = async () => {
    await authClient.signOut()
    router.invalidate()
    router.navigate({ to: "/login" })
  }
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome, {session.user.name}!</h1>
          <p className="text-muted-foreground">This is your protected dashboard.</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </div>
  )
}