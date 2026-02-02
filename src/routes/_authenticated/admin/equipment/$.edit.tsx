import { createFileRoute } from '@tanstack/react-router'
import { getAdminEquipmentByIdFn, getCategoriesFn } from '@/lib/equipment'
import { Page } from '@/components/admin/equipment/$.edit'

export const Route = createFileRoute('/_authenticated/admin/equipment/$/edit')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const equipmentId = parseInt(params._splat)
    if (!equipmentId || isNaN(equipmentId)) {
      throw new Error('Equipment ID is required')
    }

    try {
      // Get both equipment and categories
      const [equipment, categories] = await Promise.all([
        getAdminEquipmentByIdFn({ data: { equipmentId } }),
        getCategoriesFn()
      ])

      if (!equipment) {
        throw new Error('Equipment not found')
      }

      return { 
        equipment,
        categories: categories || [],
        equipmentId 
      }
    } catch (error) {
      console.error('Failed to load equipment:', error)
      throw new Error('Failed to load equipment data')
    }
  },
})

function RouteComponent() {
  const { equipment, categories, equipmentId } = Route.useLoaderData()
  return <Page equipment={equipment} categories={categories} equipmentId={equipmentId} />
}