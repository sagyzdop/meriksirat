import { equipmentColumns } from "./components/equipment-columns"
import { EquipmentDataTable } from "./components/equipment-data-table"
import { EquipmentWithCategory } from "@/lib/equipment"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  categoryId?: number
  searchQuery?: string
  minClearanceLevel?: number
  maxClearanceLevel?: number
  isActive?: boolean
  page: number
  limit: number
  sortBy: 'modelName' | 'category' | 'requiredClearanceLevel' | 'isActive' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  equipment: EquipmentWithCategory[]
  pagination: Pagination
  filters: Filters
}

export function Page({ equipment, pagination, filters }: PageProps) {
  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Equipment Management</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {pagination.total > 0 
              ? `Managing ${pagination.total} equipment item${pagination.total === 1 ? '' : 's'}`
              : "No equipment found"
            }
          </p>
        </div>
      </div>
      <EquipmentDataTable 
        data={equipment} 
        columns={equipmentColumns} 
        pagination={pagination}
        filters={filters}
      />
    </div>
  )
}