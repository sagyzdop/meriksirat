import * as React from 'react'
import { Table } from '@tanstack/react-table'
import { X, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

export interface DataTableFilter {
  column: string
  title: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }[]
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchKey?: string
  searchPlaceholder?: string
  filters?: DataTableFilter[]
  viewOptions?: React.ReactNode
  onSearchChange?: (value: string) => void
  onFilterChange?: (filterId: string, values: string[] | undefined) => void
  onClearFilters?: () => void
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder = 'Search...',
  filters = [],
  viewOptions,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}: DataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = React.useState('')
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)
  const debouncedSearch = useDebounce(searchValue, 300)

  // Handle debounced search
  React.useEffect(() => {
    if (searchKey && onSearchChange) {
      onSearchChange(debouncedSearch)
    } else if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(debouncedSearch)
    }
  }, [debouncedSearch, searchKey, table, onSearchChange])

  // Check if any filters are active
  const isFiltered = React.useMemo(() => {
    return filters.some((filter) => {
      const column = table.getColumn(filter.column)
      const filterValue = column?.getFilterValue()
      return (
        filterValue &&
        (Array.isArray(filterValue) ? filterValue.length > 0 : true)
      )
    })
  }, [table, filters])

  const handleClearFilters = () => {
    if (onClearFilters) {
      onClearFilters()
    } else {
      // Clear all column filters
      table.resetColumnFilters()
    }
    setSearchValue('')
  }

  // Filter component for desktop
  const FilterButton = ({ filter }: { filter: DataTableFilter }) => {
    const column = table.getColumn(filter.column)
    const filterValue = column?.getFilterValue() as string[] | undefined
    const selectedSet = new Set(filterValue || [])

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 border-dashed">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {filter.title}
            {selectedSet.size > 0 && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal lg:hidden"
                >
                  {selectedSet.size}
                </Badge>
                <div className="hidden space-x-1 lg:flex">
                  {selectedSet.size > 2 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {selectedSet.size} selected
                    </Badge>
                  ) : (
                    filter.options
                      .filter((option) => selectedSet.has(option.value))
                      .map((option) => (
                        <Badge
                          variant="secondary"
                          key={option.value}
                          className="rounded-sm px-1 font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder={filter.title} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {filter.options.map((option) => {
                  const isSelected = selectedSet.has(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        const newSelectedValues = new Set(filterValue || [])
                        if (isSelected) {
                          newSelectedValues.delete(option.value)
                        } else {
                          newSelectedValues.add(option.value)
                        }
                        const values = Array.from(newSelectedValues)

                        if (onFilterChange) {
                          onFilterChange(
                            filter.column,
                            values.length ? values : undefined
                          )
                        } else {
                          column?.setFilterValue(
                            values.length ? values : undefined
                          )
                        }
                      }}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50'
                        )}
                      >
                        {isSelected && (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // Filter content for mobile sheet
  const FilterContent = () => (
    <div className="space-y-4">
      {filters.map((filter) => {
        const column = table.getColumn(filter.column)
        const filterValue = column?.getFilterValue() as string[] | undefined
        const selectedSet = new Set(filterValue || [])

        return (
          <div key={filter.column} className="space-y-2">
            <h4 className="text-sm font-medium">{filter.title}</h4>
            <div className="space-y-2">
              {filter.options.map((option) => {
                const isSelected = selectedSet.has(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      const newSelectedValues = new Set(filterValue || [])
                      if (isSelected) {
                        newSelectedValues.delete(option.value)
                      } else {
                        newSelectedValues.add(option.value)
                      }
                      const values = Array.from(newSelectedValues)

                      if (onFilterChange) {
                        onFilterChange(
                          filter.column,
                          values.length ? values : undefined
                        )
                      } else {
                        column?.setFilterValue(
                          values.length ? values : undefined
                        )
                      }
                    }}
                    className={cn(
                      'flex w-full items-center space-x-2 rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent',
                      isSelected && 'border-primary bg-accent'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50'
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    {option.icon && (
                      <option.icon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search Input */}
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
        )}

        {/* Desktop Filters */}
        <div className="hidden md:flex md:flex-wrap md:gap-2">
          {filters.map((filter) => (
            <FilterButton key={filter.column} filter={filter} />
          ))}
        </div>

        {/* Mobile Filter Sheet */}
        {filters.length > 0 && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 md:hidden">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {isFiltered && (
                  <Badge
                    variant="secondary"
                    className="ml-2 rounded-sm px-1 font-normal"
                  >
                    Active
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Apply filters to refine your results
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <FilterContent />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Clear Filters Button */}
        {(isFiltered || searchValue) && (
          <Button
            variant="ghost"
            onClick={handleClearFilters}
            className="h-8 px-2 lg:px-3"
          >
            Clear
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* View Options */}
      {viewOptions && (
        <div className="flex items-center gap-2">{viewOptions}</div>
      )}
    </div>
  )
}
