import { queryOptions } from '@tanstack/react-query'
import {
  getBirthdayWishMessageFn,
  getUpcomingBirthdaysFn,
} from './functions/birthdays'
import type { BirthdayListFilters } from './types'

export const birthdayQueries = {
  all: ['birthdays'] as const,
  lists: () => ['birthdays', 'list'] as const,
  // The key is scoped per user so a shared browser never serves one member's
  // "no birthday" (null) or cached message to another.
  wishMessage: (userId: string) =>
    queryOptions({
      queryKey: [...birthdayQueries.all, 'wish-message', userId],
      staleTime: Infinity,
      queryFn: async (): Promise<string | null> => getBirthdayWishMessageFn(),
    }),
  adminList: (filters: BirthdayListFilters) =>
    queryOptions({
      queryKey: [...birthdayQueries.lists(), filters],
      queryFn: () => getUpcomingBirthdaysFn({ data: filters }),
    }),
}
