import * as React from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { EquipmentBookingBlock } from "./components/equipment-booking-block";
import { Equipment, Category } from "./components/types";
import { useSelection } from "@/hooks/use-selection";

interface Filters {
  categoryId?: number
  searchQuery?: string
  mode?: 'add-to-booking'
  bookingId?: number
  returnTo?: string
}

interface PageProps {
  equipment: Equipment[]
  categories: Category[]
  filters: Filters
  isLoading?: boolean
}

export function Page({ equipment, categories, filters, isLoading = false }: PageProps) {
  const navigate = useNavigate({ from: '/equipment/' })
  const router = useRouter()
  const isAddMode = filters.mode === 'add-to-booking'
  const selection = useSelection({
    items: equipment,
    getId: (item) => item.id,
    storageKey: "equipment-selection",
  })

  // Start with a fresh selection when arriving in add-to-booking mode so only
  // the newly chosen items are added to the booking.
  const clearedOnMount = React.useRef(false)
  React.useEffect(() => {
    if (isAddMode && !clearedOnMount.current) {
      clearedOnMount.current = true
      selection.clearSelection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddMode])

  const handleBookSelected = () => {
    if (selection.selectedIds.length === 0) return

    if (isAddMode && filters.returnTo) {
      const separator = filters.returnTo.includes('?') ? '&' : '?'
      router.navigate({
        href: `${filters.returnTo}${separator}equipmentIds=${selection.selectedIds.join(',')}`,
      })
      return
    }

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
      addMode={isAddMode}
      bookingId={filters.bookingId}
      ctaLabel={isAddMode ? 'Add to Booking' : 'View & Book Selected'}
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
