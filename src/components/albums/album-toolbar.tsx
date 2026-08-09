import * as React from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { DataTableFacetedFilter } from '@/components/admin/equipment/index/components/data-table-faceted-filter'
import type {
  AlbumListFilters,
  AlbumOwnershipFilter,
  AlbumVisibilityFilter,
} from '@/lib/albums'

const ownershipOptions = [
  { value: 'owner', label: 'Owned by me' },
  { value: 'co-author', label: 'Shared with me' },
]
const visibilityOptions = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]

interface AlbumToolbarProps {
  filters: AlbumListFilters
  onFiltersChange: (next: Partial<AlbumListFilters>) => void
  showOwnership?: boolean
  showVisibility?: boolean
}

/**
 * Search + filter row for album lists, styled like the admin equipment
 * toolbar. Search covers album titles and descriptions.
 */
export function AlbumToolbar({
  filters,
  onFiltersChange,
  showOwnership = true,
  showVisibility = true,
}: AlbumToolbarProps) {
  const [localSearch, setLocalSearch] = React.useState(filters.search)
  const debouncedSearch = useDebounce(localSearch, 300)

  // Keep the input in sync when the URL param changes (e.g. reset).
  React.useEffect(() => {
    setLocalSearch(filters.search)
  }, [filters.search])

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // Single-select semantics: the faceted filter toggles, so the last item in
  // the returned array is the one the user just chose; empty means cleared.
  const single = (values: string[] | undefined, current: string) =>
    values && values.length > 0 ? values[values.length - 1] : 'all'

  const ownershipSelected =
    filters.ownership !== 'all' ? [filters.ownership] : []
  const visibilitySelected =
    filters.visibility !== 'all' ? [filters.visibility] : []
  const isFiltered =
    !!filters.search ||
    filters.ownership !== 'all' ||
    filters.visibility !== 'all'

  const reset = () =>
    onFiltersChange({ search: '', ownership: 'all', visibility: 'all' })

  return (
    <div className="-mt-2 mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        placeholder="Search albums by title or description..."
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
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
                ownership: single(
                  values,
                  filters.ownership
                ) as AlbumOwnershipFilter,
              })
            }
          />
        )}
        {showVisibility && (
          <DataTableFacetedFilter
            title="Visibility"
            options={visibilityOptions}
            selectedValues={visibilitySelected}
            onSelectionChange={(values) =>
              onFiltersChange({
                visibility: single(
                  values,
                  filters.visibility
                ) as AlbumVisibilityFilter,
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
