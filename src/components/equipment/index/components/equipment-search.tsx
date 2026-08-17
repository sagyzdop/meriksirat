import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { Search, X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface EquipmentSearchProps {
  searchQuery?: string
  onSearchChange: (value: string) => void
  className?: string
}

export function EquipmentSearch({
  searchQuery,
  onSearchChange,
  className,
}: EquipmentSearchProps) {
  const searchQueryValue = searchQuery || ''
  const [localValue, setLocalValue] = useState(searchQueryValue)
  const debouncedValue = useDebounce(localValue, 300)

  // Trigger search change when the debounced value settles on a new input value.
  // Only depends on the debounced value: an external prop change (e.g. a category
  // click clearing searchQuery) resets the local input, and the equality guard
  // below prevents it from being re-applied to the URL.
  useEffect(() => {
    if (debouncedValue === searchQueryValue) return
    onSearchChange(debouncedValue)
  }, [debouncedValue])

  // Update local value when searchQuery prop changes (e.g., on navigation)
  useEffect(() => {
    setLocalValue(searchQueryValue)
  }, [searchQueryValue])

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        placeholder="Search equipment..."
        className="h-9 w-full pl-8 pr-8"
      />
      {localValue && (
        <button
          type="button"
          onClick={() => setLocalValue('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
