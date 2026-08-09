import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import type { AlbumFilter } from '@/lib/albums'

const FILTERS: { value: AlbumFilter; label: string }[] = [
  { value: 'all', label: 'All albums' },
  { value: 'owned', label: 'Owned by me' },
  { value: 'shared-by-me', label: 'Shared by me' },
  { value: 'shared-with-me', label: 'Shared with me' },
]

interface AlbumFilterComboboxProps {
  value: AlbumFilter
  onSelect: (filter: AlbumFilter) => void
}

export function AlbumFilterCombobox({
  value,
  onSelect,
}: AlbumFilterComboboxProps) {
  const selected = FILTERS.find((f) => f.value === value) ?? FILTERS[0]
  const items = FILTERS.map((f) => f.value)
  const lookup = new Map<AlbumFilter, (typeof FILTERS)[number]>(
    FILTERS.map((f) => [f.value, f])
  )

  return (
    <Combobox
      items={items}
      value={value}
      filter={() => true}
      onValueChange={(next) => {
        if (next) onSelect(next as AlbumFilter)
      }}
    >
      <Button asChild variant="outline" size="sm" className="w-full sm:w-48">
        <ComboboxTrigger>
          <span className="truncate">{selected.label}</span>
        </ComboboxTrigger>
      </Button>
      <ComboboxContent align="start" className="min-w-[var(--anchor-width)]">
        <ComboboxEmpty>No filters found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => {
            const option = lookup.get(item as AlbumFilter)
            if (!option) return null
            return (
              <ComboboxItem key={option.value} value={option.value}>
                <span className="truncate">{option.label}</span>
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
