import { queryOptions } from '@tanstack/react-query'
import { getBirthdayWishMessageFn } from './functions/birthdays'

export const birthdayQueries = {
  all: ['birthdays'] as const,
  wishMessage: () =>
    queryOptions({
      queryKey: [...birthdayQueries.all, 'wish-message'],
      staleTime: Infinity,
      queryFn: async (): Promise<string> => getBirthdayWishMessageFn(),
    }),
}
