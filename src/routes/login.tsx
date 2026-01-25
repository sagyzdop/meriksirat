import { createFileRoute, redirect } from "@tanstack/react-router"
import { LoginForm } from "@/components/auth/login-form"
import { getSessionFn } from "@/lib/session"

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getSessionFn()
    
    // If already logged in, redirect to dashboard
    if (session?.user) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm />
    </div>
  )
}