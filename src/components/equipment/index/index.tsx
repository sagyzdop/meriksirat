import * as React from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EquipmentBookingBlock } from './components/equipment-booking-block'
import { Equipment, Category } from './components/types'
import { useSelection } from '@/hooks/use-selection'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import { bookingsQueries } from '@/lib/booking'
import {
  buildAvailabilityWindow,
  useEquipmentAvailability,
} from './hooks/use-equipment-availability'

interface Filters {
  categoryId?: number
  searchQuery?: string
  mode?: 'add-to-booking'
  bookingId?: number
  returnTo?: string
  availabilityDate?: string
  availabilityTime?: string
  availabilityOnly?: boolean
}

interface PageProps {
  equipment: Equipment[]
  categories: Category[]
  filters: Filters
  disabledEquipmentIds?: number[]
  isLoading?: boolean
}

export function Page({
  equipment,
  categories,
  filters,
  disabledEquipmentIds = [],
  isLoading = false,
}: PageProps) {
  const navigate = useNavigate({ from: '/equipment/' })
  const router = useRouter()
  const goBack = useBackNavigation('/equipment')
  const isAddMode = filters.mode === 'add-to-booking'
  const selection = useSelection({
    items: equipment,
    getId: (item) => item.id,
    storageKey: 'equipment-selection',
  })

  const { data: bookingWindow } = useQuery(
    bookingsQueries.bookingWindow(filters.bookingId)
  )

  const window = React.useMemo(() => {
    if (isAddMode) {
      if (!bookingWindow) return null
      return {
        timeMin: bookingWindow.startTime,
        timeMax: bookingWindow.endTime,
      }
    }
    return buildAvailabilityWindow(
      filters.availabilityDate,
      filters.availabilityTime
    )
  }, [
    isAddMode,
    bookingWindow,
    filters.availabilityDate,
    filters.availabilityTime,
  ])

  const availability = useEquipmentAvailability({ equipment, window })

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

  const equipmentById = React.useMemo(
    () => new Map(equipment.map((item) => [item.id, item])),
    [equipment]
  )

  const handleBookSelected = async () => {
    if (selection.selectedIds.length === 0) return

    if (isAddMode && filters.returnTo) {
      // Re-run the availability check on click so the selected items are
      // verified against the booking window right before adding them.
      const result = await availability.refetch()
      const busyCalendarIds = result.data ?? new Set<string>()
      const conflicts = selection.selectedIds.filter((id) => {
        const item = equipmentById.get(id)
        return item ? busyCalendarIds.has(item.googleCalendarId) : false
      })

      if (conflicts.length > 0) {
        const names = conflicts.map(
          (id) => equipmentById.get(id)?.modelName ?? `Equipment ${id}`
        )
        toast.error(
          `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} not available during this booking's time window`
        )
        return
      }

      const separator = filters.returnTo.includes('?') ? '&' : '?'
      // Replace the equipment page history entry so Back from the booking page
      // never lands on the add-to-booking equipment screen again.
      router.navigate({
        href: `${filters.returnTo}${separator}equipmentIds=${selection.selectedIds.join(',')}`,
        replace: true,
      })
      return
    }

    navigate({
      to: '/bookings/new',
      search: { equipmentIds: selection.selectedIds },
    })
  }

  const handleAddModeBack = () => {
    if (isAddMode && filters.returnTo) {
      router.navigate({ href: filters.returnTo, replace: true })
      return
    }
    goBack()
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

  const handleAvailabilityDateChange = (dateKey?: string) => {
    navigate({
      search: (prev) => ({ ...prev, availabilityDate: dateKey }),
      replace: true,
    })
  }

  const handleAvailabilityTimeChange = (time?: string) => {
    navigate({
      search: (prev) => ({ ...prev, availabilityTime: time }),
      replace: true,
    })
  }

  const handleAvailabilityOnlyChange = (value: boolean) => {
    navigate({
      search: (prev) => ({ ...prev, availabilityOnly: value || undefined }),
      replace: true,
    })
  }

  return (
    <EquipmentBookingBlock
      equipment={equipment}
      categories={categories}
      filters={filters}
      addMode={isAddMode}
      bookingId={filters.bookingId}
      bookingWindow={bookingWindow}
      ctaLabel={isAddMode ? 'Add to Booking' : 'View & Book Selected'}
      selection={{
        selectedIds: selection.selectedIds,
        toggleSelection: selection.toggleSelection,
        clearSelection: selection.clearSelection,
      }}
      disabledEquipmentIds={disabledEquipmentIds}
      availabilityByEquipmentId={availability.busyByEquipmentId}
      availabilityLoading={availability.isChecking}
      onBookSelected={handleBookSelected}
      onAddModeBack={handleAddModeBack}
      onSearchChange={handleSearchChange}
      onCategorySelect={handleCategorySelect}
      onAvailabilityDateChange={handleAvailabilityDateChange}
      onAvailabilityTimeChange={handleAvailabilityTimeChange}
      onAvailabilityOnlyChange={handleAvailabilityOnlyChange}
      isLoading={isLoading}
    />
  )
}
