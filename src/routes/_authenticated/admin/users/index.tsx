import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/users/index'
import { usersQueries } from '@/lib/user'
import { numberArrayParam, stringArrayParam } from '@/lib/search-params'
import { z } from 'zod'

const searchSchema = z.object({
  role: stringArrayParam(z.enum(['user', 'manager', 'admin'])),
  status: stringArrayParam(
    z.enum([
      'Active',
      'Inactive',
      'On Probation',
      'Board',
      'Ex-Board',
      'Roommate',
      'Ex-Roommate',
      'Graduated',
    ])
  ),
  clearanceLevel: numberArrayParam(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  sortBy: z
    .enum([
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'clearanceLevel',
      'createdAt',
    ])
    .default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const Route = createFileRoute('/_authenticated/admin/users/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        usersQueries.adminList(deps.search)
      )
    } catch (error) {
      console.error('[Users Route Loader] Failed to load users:', error)
    }
  },
})

function RouteComponent() {
  const search = Route.useSearch()
  const { adminUser } = Route.useRouteContext()
  const { data, isFetching } = useQuery(usersQueries.adminList(search))
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending',
  })

  return (
    <Page
      users={data?.users ?? []}
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
      canAssignElevatedRoles={adminUser?.role === 'admin'}
    />
  )
}
