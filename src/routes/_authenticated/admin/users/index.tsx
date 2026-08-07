import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page } from '@/components/admin/users/index'
import { usersQueries } from '@/lib/user'
import { z } from 'zod'

const searchSchema = z.object({
  role: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val
        if (typeof val === 'string') {
          if (val === '') return undefined
          if (val.startsWith('[') && val.endsWith(']')) {
            try {
              const parsed = JSON.parse(val)
              if (Array.isArray(parsed)) return parsed
            } catch (e) {}
          }
          if (val.includes(',')) return val.split(',')
          return [val]
        }
        return val === null ? undefined : val
      },
      z.array(z.enum(['user', 'manager', 'admin']))
    )
    .optional(),
  status: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val
        if (typeof val === 'string') {
          if (val === '') return undefined
          if (val.startsWith('[') && val.endsWith(']')) {
            try {
              const parsed = JSON.parse(val)
              if (Array.isArray(parsed)) return parsed
            } catch (e) {}
          }
          if (val.includes(',')) return val.split(',')
          return [val]
        }
        return val === null ? undefined : val
      },
      z.array(
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
      )
    )
    .optional(),
  clearanceLevel: z
    .preprocess((val) => {
      if (Array.isArray(val)) return val.map(Number)
      if (typeof val === 'number') return [val]
      if (typeof val === 'string') {
        if (val === '') return undefined
        if (val.startsWith('[') && val.endsWith(']')) {
          try {
            const parsed = JSON.parse(val)
            if (Array.isArray(parsed)) return parsed.map(Number)
          } catch (e) {}
        }
        if (val.includes(',')) return val.split(',').map(Number)
        return [Number(val)]
      }
      return val === null ? undefined : val
    }, z.array(z.coerce.number()))
    .optional(),
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
