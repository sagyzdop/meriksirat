import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/search-input'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import type { AlbumListFilters, AlbumOwnershipFilter } from '@/lib/albums'

const ownershipOptions = [
  { value: 'owner', label: 'Owned by me' },
  { value: 'co-author', label: 'Shared with me' },
]

interface AlbumToolbarProps {
  filters: AlbumListFilters
  onFiltersChange: (next: Partial<AlbumListFilters>) => void
  showOwnership?: boolean
}

/**
 * Search + filter row for album lists, styled like the admin equipment
 * toolbar. Search covers album titles and descriptions.
 */
export function AlbumToolbar({
  filters,
  onFiltersChange,
  showOwnership = true,
}: AlbumToolbarProps) {
  // Multi-select semantics: the faceted filter toggles individual values and
  // an empty array (or undefined) means no filter.
  const ownershipSelected = filters.ownership ?? []
  const isFiltered = !!filters.search || (filters.ownership?.length ?? 0) > 0

  const reset = () => onFiltersChange({ search: '', ownership: [] })

  return (
    <div className="-mt-2 mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput
        placeholder="Search albums by title or description..."
        value={filters.search}
        onChange={(search) => onFiltersChange({ search })}
        className="h-8 w-full sm:w-[220px] lg:w-[300px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {showOwnership && (
          <DataTableFacetedFilter
            title="Ownership"
            options={ownershipOptions}
            selectedValues={ownershipSelected}
            onSelectionChange={(values) =>
              onFiltersChange({
                ownership: (values ?? []) as AlbumOwnershipFilter[],
              })
            }
          />
        )}
        {isFiltered && (
          <Button variant="ghost" onClick={reset} className="h-8 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
