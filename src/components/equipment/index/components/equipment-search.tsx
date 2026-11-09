import { SearchInput } from '@/components/shared/search-input'
import { cn } from '@/lib/utils'

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
  return (
    <SearchInput
      value={searchQuery ?? ''}
      onChange={onSearchChange}
      placeholder="Search equipment..."
      className={cn('h-9 w-full', className)}
    />
  )
}
