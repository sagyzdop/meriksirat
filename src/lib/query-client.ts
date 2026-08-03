import { QueryClient } from '@tanstack/react-query'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

let clientQueryClient: QueryClient | undefined

/**
 * Returns a shared QueryClient instance.
 * On the server (SSR) a fresh instance is created per request to avoid
 * cross-request cache pollution. On the client a single instance is reused.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return createQueryClient()
  }

  if (!clientQueryClient) {
    clientQueryClient = createQueryClient()
  }

  return clientQueryClient
}
