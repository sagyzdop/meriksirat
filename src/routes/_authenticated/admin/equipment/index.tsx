import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/admin/equipment/index/page'
import { getAdminEquipmentFn } from '@/lib/equipment'
import { z } from 'zod'

const searchSchema = z.object({
  categoryId: z.coerce.number().optional(),
  searchQuery: z.string().optional(),
  minClearanceLevel: z.coerce.number().optional(),
  maxClearanceLevel: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  sortBy: z.enum(['modelName', 'category', 'requiredClearanceLevel', 'isActive', 'createdAt']).default('modelName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const Route = createFileRoute('/_authenticated/admin/equipment/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const search = deps.search
    try {
      const equipmentResponse = await getAdminEquipmentFn({ data: search })
      return {
        equipment: equipmentResponse?.data || [],
        pagination: equipmentResponse?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }
    } catch (error) {
      console.error('Failed to load equipment:', error)
      return {
        equipment: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }
    }
  },
})

function RouteComponent() {
  const { equipment, pagination } = Route.useLoaderData()
  const search = Route.useSearch()
  
  return (
    <Page 
      equipment={equipment} 
      pagination={pagination}
      filters={search}
    />
  )
}
