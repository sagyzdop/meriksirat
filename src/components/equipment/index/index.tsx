import { useMemo } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LayoutGrid, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getEquipmentColumns } from "./components/equipment-columns";
import { EquipmentDataTable } from "./components/equipment-data-table";
import { EquipmentGrid } from "./components/equipment-grid";
import { Equipment } from "./components/types";


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
  page: number
  limit: number
  sortBy: 'modelName' | 'category' | 'requiredClearanceLevel' | 'isActive' | 'createdAt'
  sortOrder: 'asc' | 'desc'
  viewMode: 'table' | 'grid'
}

interface PageProps {
  equipment: Equipment[]
  pagination: Pagination
  filters: Filters
  onViewModeChange: (mode: 'table' | 'grid') => void
}

export function Page({ equipment, pagination, filters, onViewModeChange }: PageProps) {

  // Get category options for filtering
  const categoryOptions = useMemo(() => {
    const uniqueCategories = new Map<string, { name: string; sortOrder: number }>();

    equipment.forEach(eq => {
      if (eq.category) {
        uniqueCategories.set(eq.categoryId!.toString(), {
          name: eq.category.name,
          sortOrder: eq.category.sortOrder ?? 0
        });
      }
    });

    // Convert to array and sort by sortOrder
    const sortedCategories = Array.from(uniqueCategories.entries())
      .map(([value, data]) => ({
        value,
        label: data.name,
        sortOrder: data.sortOrder
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Add uncategorized option at the end if there are items without categories
    const hasUncategorized = equipment.some(eq => !eq.category);
    if (hasUncategorized) {
      sortedCategories.push({
        value: "null",
        label: "Uncategorized",
        sortOrder: Number.MAX_SAFE_INTEGER
      });
    }

    return sortedCategories.map(({ value, label }) => ({ value, label }));
  }, [equipment]);

  // Get columns for table view
  const columns = useMemo(() => getEquipmentColumns(), []);

  // Get view mode from URL or default to table
  const viewMode = filters.viewMode || 'table'

  const description = pagination.total > 0
    ? `Showing ${equipment.length} of ${pagination.total} equipment item${pagination.total === 1 ? '' : 's'}`
    : "No equipment found"

  return (
    <PageContainer>
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

      {/* Table View */}
      {viewMode === "table" && (
        <EquipmentDataTable
          columns={columns}
          data={equipment}
          pagination={pagination}
          filters={filters}
          categoryOptions={categoryOptions}
        />
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <EquipmentGrid
          equipment={equipment}
          viewMode="grid"
          hasActiveFilters={!!filters.categoryId || !!filters.searchQuery}
        />
      )}
    </PageContainer>
  );
}
