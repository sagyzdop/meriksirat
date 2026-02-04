
import { useState } from "react"
import { createEquipmentColumns } from "./components/equipment-columns"
import { EquipmentDataTable } from "./components/equipment-data-table"
import { EquipmentDeleteDialog } from "./components/equipment-delete-dialog"
import { EquipmentWithCategory } from "@/lib/equipment"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { Link } from "@tanstack/react-router"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  categoryIds?: number[]
  searchQuery?: string
  minClearanceLevel?: number
  maxClearanceLevel?: number
  isActive?: boolean[]
  page: number
  limit: number
  sortBy: 'modelName' | 'category' | 'requiredClearanceLevel' | 'isActive' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  equipment: EquipmentWithCategory[]
  categories: { id: number; name: string; sortOrder: number | null }[]
  pagination: Pagination
  filters: Filters
  isLoading?: boolean
}

export function Page({ equipment, categories, pagination, filters, isLoading = false }: PageProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null)

  const handleDeleteEquipment = (equipment: EquipmentWithCategory) => {
    setSelectedEquipment(equipment)
    setDeleteDialogOpen(true)
  }

  const columns = createEquipmentColumns(() => { }, handleDeleteEquipment)

  const description = pagination.total > 0
    ? `Managing ${pagination.total} equipment item${pagination.total === 1 ? '' : 's'}`
    : "No equipment found"

  return (
    <PageContainer>
      <PageHeader
        title="Manage Equipment"
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
      <EquipmentDataTable
        data={equipment}
        categories={categories}
        columns={columns}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
      />

      <EquipmentDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        equipment={selectedEquipment}
      />
    </PageContainer>
  )
}