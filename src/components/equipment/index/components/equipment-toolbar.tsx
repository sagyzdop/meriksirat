
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { useState, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { cn } from "@/lib/utils"

interface EquipmentToolbarProps {
    searchQuery?: string
    onSearchChange: (value: string) => void
    categoryOptions: { value: string; label: string }[]
    categoryIds?: number[]
    onCategoryChange: (values: string[] | undefined) => void
    onReset: () => void
    className?: string
}

export function EquipmentToolbar({
    searchQuery,
    onSearchChange,
    categoryOptions,
    categoryIds,
    onCategoryChange,
    onReset,
    className
}: EquipmentToolbarProps) {
    const searchQueryValue = searchQuery || ""
    const [localSearchValue, setLocalSearchValue] = useState(searchQueryValue)
    const debouncedSearchValue = useDebounce(localSearchValue, 300)

    // Trigger search change when debounced value changes
    useEffect(() => {
        if (debouncedSearchValue === searchQueryValue) return
        onSearchChange(debouncedSearchValue)
    }, [debouncedSearchValue, searchQueryValue, onSearchChange])

    // Update local value when searchQuery prop changes (e.g., on page navigation)
    useEffect(() => {
        setLocalSearchValue(searchQueryValue)
    }, [searchQueryValue])

    const isFiltered = (categoryIds && categoryIds.length > 0) || !!searchQuery

    return (
        <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", className)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
                <Input
                    placeholder="Search equipment..."
                    value={localSearchValue}
                    onChange={(event) => setLocalSearchValue(event.target.value)}
                    className="h-8 w-full sm:w-[200px] lg:w-[300px]"
                />
                <div className="flex flex-wrap gap-2">
                    {categoryOptions.length > 0 && (
                        <DataTableFacetedFilter
                            title="Category"
                            options={categoryOptions}
                            selectedValues={categoryIds ? categoryIds.map(id => id.toString()) : []}
                            onSelectionChange={onCategoryChange}
                        />
                    )}
                    {isFiltered && (
                        <Button
                            variant="ghost"
                            onClick={onReset}
                            className="h-8 px-2 lg:px-3"
                        >
                            Reset
                            <X className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
