import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from '@/components/equipment/index'
import { getEquipmentFn, getCategoriesFn } from '@/lib/equipment'
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
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  sortBy: z.enum(['modelName', 'category', 'requiredClearanceLevel', 'isActive', 'createdAt']).default('modelName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  viewMode: z.enum(['table', 'grid']).default('table'),
})

export const Route = createFileRoute('/_authenticated/equipment/')({
  component: RouteComponent,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const search = deps.search
    try {
      const [equipmentResponse, categories] = await Promise.all([
        getEquipmentFn({ data: search }),
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
  const navigate = Route.useNavigate()
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <Page
      equipment={equipment}
      categories={categories}
      pagination={pagination}
      filters={search}
      isLoading={isLoading}
      onViewModeChange={(mode) =>
        navigate({ search: (prev) => ({ ...prev, viewMode: mode }) })
      }
    />
  )
}