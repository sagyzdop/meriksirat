import { useRouter } from '@tanstack/react-router'
import { authClient } from '@/lib/auth/auth-client'

export function useLogout() {
  const router = useRouter()

  return async () => {
    await authClient.signOut()
    router.invalidate()
    router.navigate({ to: '/login' })
  }
}
