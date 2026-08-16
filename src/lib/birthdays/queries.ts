import { queryOptions } from '@tanstack/react-query'
import { getBirthdayWishMessageFn } from './functions/birthdays'
import { getUpcomingBirthdaysFn } from './functions/birthdays'
import type { BirthdayListFilters } from './types'

export const birthdayQueries = {
  all: ['birthdays'] as const,
  // The key is scoped per user so a shared browser never serves one member's
  // "no birthday" (null) or cached message to another.
  wishMessage: (userId: string) =>
    queryOptions({
      queryKey: [...birthdayQueries.all, 'wish-message', userId],
      staleTime: Infinity,
      queryFn: async (): Promise<string | null> => getBirthdayWishMessageFn(),
    }),
}

export const birthdaysQueries = {
  all: ['birthdays'] as const,
  lists: () => ['birthdays', 'list'] as const,
  adminList: (filters: BirthdayListFilters) =>
    queryOptions({
      queryKey: [...birthdaysQueries.lists(), filters],
      queryFn: async () =>
        (await getUpcomingBirthdaysFn({ data: filters })) ?? {
          birthdays: [],
          pagination: {
            page: filters.page,
            limit: filters.limit,
            totalCount: 0,
            totalPages: 0,
          },
        },
    }),
}
