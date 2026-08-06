import { useNavigate } from "@tanstack/react-router";
import { EquipmentBookingBlock } from "./components/equipment-booking-block";
import { Equipment, Category } from "./components/types";
import { useSelection } from "@/hooks/use-selection";

interface Filters {
  categoryId?: number
  searchQuery?: string
}

interface PageProps {
  equipment: Equipment[]
  categories: Category[]
  filters: Filters
  isLoading?: boolean
}

export function Page({ equipment, categories, filters, isLoading = false }: PageProps) {
  const navigate = useNavigate({ from: '/equipment/' })
  const selection = useSelection({
    items: equipment,
    getId: (item) => item.id,
    storageKey: "equipment-selection",
  })

  const handleBookSelected = () => {
    if (selection.selectedIds.length === 0) return
    navigate({
      to: '/bookings/new',
      search: { equipmentIds: selection.selectedIds },
    })
  }

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev) => ({ ...prev, searchQuery: value || undefined }),
      replace: true,
    })
  }

  const handleCategorySelect = (categoryId?: number) => {
    navigate({
      search: (prev) => ({ ...prev, categoryId, searchQuery: undefined }),
    })
  }

  return (
    <EquipmentBookingBlock
      equipment={equipment}
      categories={categories}
      filters={filters}
      selection={{
        selectedIds: selection.selectedIds,
        toggleSelection: selection.toggleSelection,
        clearSelection: selection.clearSelection,
      }}
      onBookSelected={handleBookSelected}
      onSearchChange={handleSearchChange}
      onCategorySelect={handleCategorySelect}
      isLoading={isLoading}
    />
  );
}
