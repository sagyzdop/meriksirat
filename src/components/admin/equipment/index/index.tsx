import { AdminTabs, equipmentTabs } from '@/components/shared/admin-tabs'
import {
  createEquipmentColumns,
  EquipmentField,
} from './components/equipment-columns'
import { EquipmentDataTable } from './components/equipment-data-table'
import { EquipmentWithCategory, updateEquipmentFn } from '@/lib/equipment'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/utils'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { PageInfo } from '@/lib/pagination'

interface Filters {
  categoryIds?: number[]
  searchQuery?: string
  minClearanceLevel?: number
  maxClearanceLevel?: number
  clearanceLevels?: number[]
  isActive?: boolean[]
  page: number
  limit: number
  sortBy:
    | 'modelName'
    | 'category'
    | 'requiredClearanceLevel'
    | 'isActive'
    | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  equipment: EquipmentWithCategory[]
  categories: { id: number; name: string; sortOrder: number | null }[]
  pagination: PageInfo
  filters: Filters
  isLoading?: boolean
}

export function Page({
  equipment,
  categories,
  pagination,
  filters,
  isLoading = false,
}: PageProps) {
  const queryClient = useQueryClient()

  const handleUpdateField = async (
    equipmentId: number,
    field: EquipmentField,
    value: string
  ) => {
    try {
      const data =
        field === 'isActive'
          ? { isActive: value === 'true' }
          : { [field]: parseInt(value) }

      await updateEquipmentFn({ data: { equipmentId, ...data } })
      await queryClient.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipment updated')
    } catch (error) {
      toast.error('Failed to update equipment', {
        description: errorMessage(error, 'An error occurred'),
      })
    }
  }

  const columns = createEquipmentColumns({
    categories,
    onUpdateField: handleUpdateField,
  })

  const description =
    pagination.total > 0
      ? `Managing ${pagination.total} equipment item${pagination.total === 1 ? '' : 's'}`
      : 'No equipment found'

  return (
    <PageContainer>
      <PageHeader
        title="Equipment"
        description={description}
        actions={
          <Button asChild>
            <Link to="/admin/equipment/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Link>
          </Button>
        }
      />
      <AdminTabs tabs={equipmentTabs} />
      <EquipmentDataTable
        data={equipment}
        categories={categories}
        columns={columns}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
      />
    </PageContainer>
  )
}
