import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LayoutGrid, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getEquipmentColumns } from "./components/equipment-columns";
import { EquipmentDataTable } from "./components/equipment-data-table";
import { EquipmentGrid } from "./components/equipment-grid";
import { Equipment } from "./components/types";
import { EquipmentToolbar } from "./components/equipment-toolbar";
import { EquipmentPagination } from "./components/equipment-pagination";


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
  page: number
  limit: number
  sortBy: 'modelName' | 'category' | 'requiredClearanceLevel' | 'isActive' | 'createdAt'
  sortOrder: 'asc' | 'desc'
  viewMode: 'table' | 'grid'
}

interface PageProps {
  equipment: Equipment[]
  categories: { id: number; name: string; sortOrder: number | null }[]
  pagination: Pagination
  filters: Filters
  onViewModeChange: (mode: 'table' | 'grid') => void
  isLoading?: boolean
}

export function Page({ equipment, categories, pagination, filters, onViewModeChange, isLoading = false }: PageProps) {
  const navigate = useNavigate()

  // Get category options for filtering
  const categoryOptions = useMemo(() => {
    const options = categories.map(cat => ({
      value: cat.id.toString(),
      label: cat.name,
      sortOrder: cat.sortOrder ?? 0
    })).sort((a, b) => a.sortOrder - b.sortOrder);

    // Add uncategorized option if there's any equipment without category
    // (Optional: handle this if needed, but categories usually covers everything)
    return options.map(({ value, label }) => ({ value, label }));
  }, [categories]);

  // Get columns for table view
  const columns = useMemo(() => getEquipmentColumns(), []);

  // Get view mode from URL or default to table
  const viewMode = filters.viewMode || 'table'

  const description = pagination.total > 0
    ? `Showing ${equipment.length} of ${pagination.total} equipment item${pagination.total === 1 ? '' : 's'}`
    : "No equipment found"

  const handleSearchChange = (value: string) => {
    navigate({
      to: '.',
      search: {
        ...filters,
        searchQuery: value || undefined,
        page: 1,
      },
    })
  }

  const handleCategoryChange = (values: string[] | undefined) => {
    const categoryIds = values && values.length > 0
      ? values.filter(v => v !== "null").map(v => parseInt(v))
      : undefined

    navigate({
      to: '.',
      search: {
        ...filters,
        categoryIds: categoryIds && categoryIds.length > 0 ? categoryIds : undefined,
        page: 1,
      },
    })
  }

  const handleReset = () => {
    navigate({
      to: '.',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'modelName',
        sortOrder: 'asc',
        viewMode: filters.viewMode
      },
    })
  }

  const handlePageChange = (newPage: number) => {
    navigate({
      to: '.',
      search: { ...filters, page: newPage },
    })
  }

  const handleLimitChange = (newLimit: number) => {
    navigate({
      to: '.',
      search: { ...filters, limit: newLimit, page: 1 },
    })
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Equipment"
        description={description}
        actions={
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => {
            if (value) {
              onViewModeChange(value as 'table' | 'grid')
            }
          }}>
            <ToggleGroupItem
              value="table"
              aria-label="Table view"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Table2 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="grid"
              aria-label="Card view"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <EquipmentToolbar
        searchQuery={filters.searchQuery}
        onSearchChange={handleSearchChange}
        categoryOptions={categoryOptions}
        categoryIds={filters.categoryIds}
        onCategoryChange={handleCategoryChange}
        onReset={handleReset}
      />

      {/* Table View */}
      {viewMode === "table" && (
        <EquipmentDataTable
          columns={columns}
          data={equipment}
          pagination={pagination}
          filters={filters}
          isLoading={isLoading}
        />
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <EquipmentGrid
          equipment={equipment}
          viewMode="grid"
          hasActiveFilters={(filters.categoryIds && filters.categoryIds.length > 0) || !!filters.searchQuery}
          isLoading={isLoading}
          className="pt-6"
        />
      )}

      <EquipmentPagination
        page={pagination.page}
        limit={pagination.limit}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    </PageContainer>
  );
}

