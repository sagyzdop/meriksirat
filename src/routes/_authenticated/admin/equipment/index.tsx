import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/admin/equipment/index'
import { getAdminEquipmentFn, getCategoriesFn } from '@/lib/equipment'
import { z } from 'zod'

const searchSchema = z.object({
  categoryIds: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
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
    return val;
  }, z.array(z.coerce.number())).optional(),
  searchQuery: z.string().optional(),
  minClearanceLevel: z.coerce.number().optional(),
  maxClearanceLevel: z.coerce.number().optional(),
  isActive: z.preprocess((val) => {
    if (Array.isArray(val)) return val.map(v => String(v) === 'true');
    if (typeof val === 'string') {
      if (val === '') return undefined;
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.map(v => String(v) === 'true');
        } catch (e) { }
      }
      if (val.includes(',')) return val.split(',').map(v => String(v) === 'true');
      return [val === 'true'];
    }
    if (typeof val === 'boolean') return [val];
    return val;
  }, z.array(z.boolean())).optional(),
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
      const [equipmentResponse, categories] = await Promise.all([
        getAdminEquipmentFn({ data: search }),
        getCategoriesFn()
      ])

      return {
        equipment: equipmentResponse?.data || [],
        categories: categories || [],
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
        categories: [],
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
  const { equipment, categories, pagination } = Route.useLoaderData()
  const search = Route.useSearch()
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <Page
      equipment={equipment}
      categories={categories}
      pagination={pagination}
      filters={search}
      isLoading={isLoading}
    />
  )
}
