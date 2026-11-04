import { queryOptions } from '@tanstack/react-query'
import { getBufferBannerFn } from './functions'

export const bufferQueries = {
  all: ['buffer'] as const,
  banner: () =>
    queryOptions({
      queryKey: [...bufferQueries.all, 'banner'],
      staleTime: 10 * 60 * 1000,
      queryFn: async (): Promise<boolean> => getBufferBannerFn(),
    }),
}
