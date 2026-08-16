import * as React from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { Equipment, Category } from './types'
import { EquipmentCategoryCombobox } from './equipment-category-combobox'
import { EquipmentCategoryNav } from './equipment-category-nav'
import { EquipmentGrid } from './equipment-grid'
import { EquipmentSearch } from './equipment-search'
import { AvailabilityFilters } from './availability-filters'
import { toCalendarDateTime } from '@/lib/google/google-caledar'
import { useIsMobile } from '@/hooks/use-mobile'

interface EquipmentBookingBlockProps {
  equipment: Equipment[]
  categories: Category[]
  filters: {
    categoryId?: number
    searchQuery?: string
    availabilityStartDate?: string
    availabilityEndDate?: string
    availabilityStartTime?: string
    availabilityEndTime?: string
    availabilityOnly?: boolean
  }
  selection: {
    selectedIds: number[]
    toggleSelection: (id: number) => void
    clearSelection: () => void
  }
  onBookSelected: () => void
  onAddModeBack: () => void
  onSearchChange: (value: string) => void
  onCategorySelect: (categoryId?: number) => void
  onAvailabilityStartDateChange: (value?: string) => void
  onAvailabilityEndDateChange: (value?: string) => void
  onAvailabilityStartTimeChange: (value?: string) => void
  onAvailabilityEndTimeChange: (value?: string) => void
  onAvailabilityOnlyChange: (value: boolean) => void
  defaultStartTime: string
  defaultEndTime: string
  operatingHoursStart: number
  operatingHoursEnd: number
  disabledEquipmentIds?: number[]
  availabilityByEquipmentId?: Map<number, boolean>
  availabilityLoading?: boolean
  isLoading?: boolean
  addMode?: boolean
  bookingId?: number
  bookingWindow?: { startTime: string; endTime: string } | null
  ctaLabel?: string
}

interface EquipmentGroup {
  key: string
  name: string
  items: Equipment[]
}

export function EquipmentBookingBlock({
  equipment,
  categories,
  filters,
  selection,
  onBookSelected,
  onAddModeBack,
  onSearchChange,
  onCategorySelect,
  onAvailabilityStartDateChange,
  onAvailabilityEndDateChange,
  onAvailabilityStartTimeChange,
  onAvailabilityEndTimeChange,
  onAvailabilityOnlyChange,
  defaultStartTime,
  defaultEndTime,
  operatingHoursStart,
  operatingHoursEnd,
  disabledEquipmentIds = [],
  availabilityByEquipmentId,
  availabilityLoading = false,
  isLoading = false,
  addMode = false,
  bookingId,
  bookingWindow,
  ctaLabel = 'View & Book Selected',
}: EquipmentBookingBlockProps) {
  const searchQuery = filters.searchQuery?.trim() ?? ''
  const isSearching = searchQuery.length > 0
  const hasActiveFilters =
    isSearching ||
    filters.categoryId !== undefined ||
    filters.availabilityOnly === true ||
    filters.availabilityStartDate !== undefined ||
    filters.availabilityEndDate !== undefined ||
    filters.availabilityStartTime !== undefined ||
    filters.availabilityEndTime !== undefined
  const selectedCount = selection.selectedIds.length
  const isMobile = useIsMobile()

  const availabilityFilteredEquipment = React.useMemo(() => {
    if (!filters.availabilityOnly || availabilityLoading) return equipment
    return equipment.filter(
      (item) =>
        disabledEquipmentIds.includes(item.id) ||
        (item.isActive !== false && !availabilityByEquipmentId?.get(item.id))
    )
  }, [
    equipment,
    filters.availabilityOnly,
    availabilityLoading,
    availabilityByEquipmentId,
    disabledEquipmentIds,
  ])

  const filteredEquipment = React.useMemo(() => {
    if (isSearching) {
      const query = searchQuery.toLowerCase()
      return availabilityFilteredEquipment.filter(
        (item) =>
          item.modelName.toLowerCase().includes(query) ||
          (item.description ?? '').toLowerCase().includes(query) ||
          (item.category?.name ?? '').toLowerCase().includes(query)
      )
    }
    if (filters.categoryId !== undefined) {
      return availabilityFilteredEquipment.filter(
        (item) => item.categoryId === filters.categoryId
      )
    }
    return availabilityFilteredEquipment
  }, [
    availabilityFilteredEquipment,
    isSearching,
    searchQuery,
    filters.categoryId,
  ])

  const bookingWindowLabel = bookingWindow
    ? `${toCalendarDateTime(bookingWindow.startTime).slice(11, 16)} – ${toCalendarDateTime(bookingWindow.endTime).slice(11, 16)}`
    : null

  const equipmentCounts = React.useMemo(() => {
    const counts: Record<number, number> = {}
    for (const item of equipment) {
      if (item.categoryId !== null && item.categoryId !== undefined) {
        counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1
      }
    }
    return counts
  }, [equipment])

  const groups = React.useMemo(() => {
    const grouped = new Map<string, EquipmentGroup>()
    for (const item of filteredEquipment) {
      const category = item.category
      const key = category ? `category-${category.id}` : 'uncategorized'
      const existing = grouped.get(key)
      if (existing) {
        existing.items.push(item)
      } else {
        grouped.set(key, {
          key,
          name: category?.name ?? 'Uncategorized',
          items: [item],
        })
      }
    }

    const sortedCategories = [...categories].sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    )

    const result: EquipmentGroup[] = []
    for (const category of sortedCategories) {
      const group = grouped.get(`category-${category.id}`)
      if (group) {
        result.push(group)
        grouped.delete(`category-${category.id}`)
      }
    }
    const uncategorized = grouped.get('uncategorized')
    if (uncategorized) {
      result.push(uncategorized)
    }
    return result
  }, [filteredEquipment, categories])

  const categoryNavProps = {
    categories,
    equipmentCounts,
    totalCount: equipment.length,
    activeCategoryId: filters.categoryId,
    isSearching,
  }

  return (
    <SidebarProvider className="h-[calc(100svh-var(--header-height))] min-h-0!">
      <Sidebar collapsible="none" className="hidden md:flex">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <EquipmentCategoryNav
                {...categoryNavProps}
                onSelect={onCategorySelect}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 flex-col gap-2 border-b px-4 py-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              {addMode && (
                <div className="flex items-center gap-3 md:mr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={onAddModeBack}
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back
                  </Button>
                  {bookingId !== undefined && (
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      Adding to booking #{bookingId}
                    </span>
                  )}
                  {bookingWindowLabel && (
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      Window: {bookingWindowLabel}
                    </span>
                  )}
                </div>
              )}
              <EquipmentSearch
                searchQuery={filters.searchQuery}
                onSearchChange={onSearchChange}
                className="w-full md:max-w-sm md:flex-1"
              />
              {isMobile && (
                <div className="flex w-full items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <EquipmentCategoryCombobox
                      {...categoryNavProps}
                      onSelect={onCategorySelect}
                    />
                  </div>
                </div>
              )}
            </div>
            {!addMode && (
              <div className="w-full">
                <AvailabilityFilters
                  startDate={filters.availabilityStartDate}
                  endDate={filters.availabilityEndDate}
                  startTime={filters.availabilityStartTime}
                  endTime={filters.availabilityEndTime}
                  defaultStartTime={defaultStartTime}
                  defaultEndTime={defaultEndTime}
                  operatingHoursStart={operatingHoursStart}
                  operatingHoursEnd={operatingHoursEnd}
                  availableOnly={filters.availabilityOnly ?? false}
                  onStartDateChange={onAvailabilityStartDateChange}
                  onEndDateChange={onAvailabilityEndDateChange}
                  onStartTimeChange={onAvailabilityStartTimeChange}
                  onEndTimeChange={onAvailabilityEndTimeChange}
                  onAvailableOnlyChange={onAvailabilityOnlyChange}
                />
              </div>
            )}
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-20">
            {isLoading && equipment.length === 0 ? (
              <EquipmentGrid equipment={[]} isLoading />
            ) : groups.length === 0 ? (
              <EquipmentGrid
                equipment={[]}
                hasActiveFilters={hasActiveFilters}
              />
            ) : (
              groups.map((group) => (
                <div key={group.key} className="mb-8 last:mb-0">
                  <h2 className="mb-4 flex items-baseline gap-2 text-lg font-semibold">
                    {group.name}
                    <span className="text-sm font-normal text-muted-foreground">
                      {group.items.length}
                    </span>
                  </h2>
                  <EquipmentGrid
                    equipment={group.items}
                    hasActiveFilters={hasActiveFilters}
                    selectedEquipmentIds={selection.selectedIds}
                    disabledEquipmentIds={disabledEquipmentIds}
                    availabilityByEquipmentId={availabilityByEquipmentId}
                    availabilityLoading={availabilityLoading}
                    onToggleSelect={selection.toggleSelection}
                  />
                </div>
              ))
            )}
          </div>
        </main>

        <footer className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-2 border-t bg-background p-4">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={selection.clearSelection}
              >
                Clear selection
              </Button>
            )}
            <Button
              size="sm"
              onClick={onBookSelected}
              disabled={selectedCount === 0}
            >
              {ctaLabel}
            </Button>
          </div>
        </footer>
      </div>
    </SidebarProvider>
  )
}
