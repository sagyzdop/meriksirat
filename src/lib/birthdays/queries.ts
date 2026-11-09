import { queryOptions } from '@tanstack/react-query'
import { getUpcomingBirthdaysFn } from './functions/birthdays'
import type { BirthdayListFilters } from './types'

export const birthdayQueries = {
  all: ['birthdays'] as const,
  lists: () => ['birthdays', 'list'] as const,
  adminList: (filters: BirthdayListFilters) =>
    queryOptions({
      queryKey: [...birthdayQueries.lists(), filters],
      queryFn: () => getUpcomingBirthdaysFn({ data: filters }),
    }),
}
