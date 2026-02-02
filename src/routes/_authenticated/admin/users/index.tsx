import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/users/index'
import { getAdminUsersFn } from '@/lib/user'
import { z } from 'zod'

const searchSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']).optional(),
  status: z.enum(['Active', 'Inactive', 'On Probation', 'Board', 'Ex-Board', 'Roommate', 'Ex-Roommate', 'Graduated']).optional(),
  clearanceLevel: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sortBy: z.enum(['name', 'email', 'role', 'status', 'clearanceLevel', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const Route = createFileRoute('/_authenticated/admin/users/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const search = deps.search
    console.log('[Users Route Loader] Search from deps:', search)
    
    try {
      const usersResponse = await getAdminUsersFn({ data: search })
      console.log('[Users Route Loader] Response:', usersResponse)
      
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
  
  return (
    <Page 
      users={users} 
      pagination={pagination}
      filters={search}
    />
  )
}