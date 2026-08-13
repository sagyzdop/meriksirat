import { useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'

/**
 * Smart back navigation.
 *
 * Returns a handler that goes back in the app's browser history when there is
 * an in-app entry to return to, and falls back to navigating to `fallbackPath`
 * when the page was opened directly (deep link, fresh tab) so Back never
 * leaves the app or bounces through unrelated pages.
 */
export function useBackNavigation(fallbackPath: string) {
  const router = useRouter()

  return useCallback(() => {
    if (router.history.canGoBack()) {
      router.history.back()
    } else {
      router.navigate({ href: fallbackPath })
    }
  }, [router, fallbackPath])
}
