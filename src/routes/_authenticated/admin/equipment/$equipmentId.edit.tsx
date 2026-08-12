import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { getAdminEquipmentByIdFn, getCategoriesFn } from '@/lib/equipment'
import { Page } from '@/components/admin/equipment/$equipmentId.edit'
import { LoadingOverlay } from '@/components/shared/loading-overlay'

export const Route = createFileRoute(
  '/_authenticated/admin/equipment/$equipmentId/edit'
)({
  component: RouteComponent,
  loader: async ({ params }) => {
    const equipmentId = parseInt(params.equipmentId)
    if (!equipmentId || isNaN(equipmentId)) {
      throw new Error('Equipment ID is required')
    }

    try {
      // Get both equipment and categories
      const [equipment, categories] = await Promise.all([
        getAdminEquipmentByIdFn({ data: { equipmentId } }),
        getCategoriesFn(),
      ])

      if (!equipment) {
        throw new Error('Equipment not found')
      }

      return {
        equipment,
        categories: categories || [],
        equipmentId,
      }
    } catch (error) {
      console.error('Failed to load equipment:', error)
      throw new Error('Failed to load equipment data')
    }
  },
})

function RouteComponent() {
  const { equipment, categories, equipmentId } = Route.useLoaderData()
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  })
  return (
    <div className="relative">
      {isLoading && <LoadingOverlay />}
      <Page
        equipment={equipment}
        categories={categories}
        equipmentId={equipmentId}
      />
    </div>
  )
}
