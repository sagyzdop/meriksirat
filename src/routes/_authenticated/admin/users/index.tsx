import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/admin/users/index'
import { getAdminUsersFn } from '@/lib/user'
import { z } from 'zod'

const searchSchema = z.object({
  role: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      if (val === '') return undefined;
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) { }
      }
      if (val.includes(',')) return val.split(',');
      return [val];
    }
    return val === null ? undefined : val;
  }, z.array(z.enum(['user', 'manager', 'admin']))).optional(),
  status: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      if (val === '') return undefined;
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) { }
      }
      if (val.includes(',')) return val.split(',');
      return [val];
    }
    return val === null ? undefined : val;
  }, z.array(z.enum([
    'Active',
    'Inactive',
    'On Probation',
    'Board',
    'Ex-Board',
    'Roommate',
    'Ex-Roommate',
    'Graduated',
  ]))).optional(),
  clearanceLevel: z.preprocess((val) => {
    if (Array.isArray(val)) return val.map(Number);
    if (typeof val === 'number') return [val];
    if (typeof val === 'string') {
      if (val === '') return undefined;
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.map(Number);
        } catch (e) { }
      }
      if (val.includes(',')) return val.split(',').map(Number);
      return [Number(val)];
    }
    return val === null ? undefined : val;
  }, z.array(z.coerce.number())).optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'role', 'status', 'clearanceLevel', 'createdAt']).default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const Route = createFileRoute('/_authenticated/admin/users/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const search = deps.search

    try {
      const usersResponse = await getAdminUsersFn({ data: search })

      return {
        users: usersResponse?.users || [],
        pagination: usersResponse?.pagination || {
          page: 1,
          limit: 10,
          totalCount: 0,
          totalPages: 0,
        },
      }
    } catch (error) {
      console.error('[Users Route Loader] Failed to load users:', error)
      return {
        users: [],
        pagination: {
          page: 1,
          limit: 10,
          totalCount: 0,
          totalPages: 0,
        },
      }
    }
  },
})

function RouteComponent() {
  const { users, pagination } = Route.useLoaderData()
  const search = Route.useSearch()
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <Page
      users={users}
      pagination={pagination}
      filters={search}
      isLoading={isLoading}
    />
  )
}