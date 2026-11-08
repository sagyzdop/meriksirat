import { queryOptions } from '@tanstack/react-query'
import { getBufferBannerFn } from './functions'
import { getBufferAccountFn } from './account-functions'
import type { BufferAccountOverview } from './account-functions'

export const bufferQueries = {
  all: ['buffer'] as const,
  account: () =>
    queryOptions({
      queryKey: [...bufferQueries.all, 'account'],
      queryFn: async (): Promise<BufferAccountOverview> => getBufferAccountFn(),
    }),
  banner: () =>
    queryOptions({
      queryKey: [...bufferQueries.all, 'banner'],
      staleTime: 10 * 60 * 1000,
      queryFn: async (): Promise<boolean> => getBufferBannerFn(),
    }),
}
