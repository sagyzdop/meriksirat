import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { getQueryClient } from '@/lib/query-client'
import { routeTree } from '@/routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const queryClient = getQueryClient()

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: {
      queryClient,
    },
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    hydrateOptions: {
      defaultOptions: {
        queries: {
          gcTime: 5 * 60 * 1000,
        },
      },
    },
  })

  return router
}
