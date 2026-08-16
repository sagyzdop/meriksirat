import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/birthdays/index'
import { birthdaysQueries } from '@/lib/birthdays/queries'
import { booleanArrayParam } from '@/lib/search-params'
import { z } from 'zod'

const searchSchema = z.object({
  wantsCongratulation: booleanArrayParam(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum([
      'firstName',
      'lastName',
      'wantsCongratulation',
      'occurrence',
      'turningAge',
    ])
    .default('occurrence'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const Route = createFileRoute('/_authenticated/admin/birthdays')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        birthdaysQueries.adminList(deps.search)
      )
    } catch (error) {
      console.error('[Birthdays Route Loader] Failed to load birthdays:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { data, isFetching } = useQuery(birthdaysQueries.adminList(search))
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      birthdays={data?.birthdays ?? []}
      pagination={
        data?.pagination ?? {
          page: 1,
          limit: 50,
          totalCount: 0,
          totalPages: 0,
        }
      }
      filters={search}
      isLoading={isRouterPending || isFetching}
    />
  )
}
