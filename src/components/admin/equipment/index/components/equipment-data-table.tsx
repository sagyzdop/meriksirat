import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table"
import { useNavigate } from "@tanstack/react-router"
import { useDebounce } from "@/hooks/use-debounce"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { LoadingOverlay } from "@/components/shared/loading-overlay"
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { EquipmentWithCategory } from "@/lib/equipment"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  categoryIds?: number[]
  searchQuery?: string
  minClearanceLevel?: number
  maxClearanceLevel?: number
  isActive?: boolean[]
  page: number
  limit: number
  sortBy: 'modelName' | 'category' | 'requiredClearanceLevel' | 'isActive' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface EquipmentDataTableProps {
  columns: ColumnDef<EquipmentWithCategory>[]
  data: EquipmentWithCategory[]
  categories: { id: number; name: string; sortOrder: number | null }[]
  pagination: Pagination
  filters: Filters
  isLoading?: boolean
}

// Static filter options - in a real app, categories would be fetched from the server
const statusOptions = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]

export function EquipmentDataTable({ columns, data, categories, pagination, filters, isLoading = false }: EquipmentDataTableProps) {
  const navigate = useNavigate()
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const searchQueryValue = filters.searchQuery || ""
  const [localSearchValue, setLocalSearchValue] = React.useState(searchQueryValue)
  const debouncedSearchValue = useDebounce(localSearchValue, 300)
  const filtersRef = React.useRef(filters)

  React.useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  // Trigger search change when debounced value changes
  React.useEffect(() => {
    if (debouncedSearchValue === searchQueryValue) return
    const currentFilters = filtersRef.current
    navigate({
      to: '.',
      search: {
        ...currentFilters,
        searchQuery: debouncedSearchValue || undefined,
        page: 1,
      },
    })
  }, [debouncedSearchValue, searchQueryValue, navigate])

  // Update local value when searchQuery prop changes (e.g., on page navigation)
  React.useEffect(() => {
    setLocalSearchValue(searchQueryValue)
  }, [searchQueryValue])

  // Controlled sorting state - sync with URL params
  const [sorting, setSorting] = React.useState<SortingState>([{
    id: filters.sortBy,
    desc: filters.sortOrder === 'desc'
  }])

  // Get category options for filtering from pre-fetched categories
  const categoryOptions = React.useMemo(() => {
    const options = categories.map(cat => ({
      value: cat.id.toString(),
      label: cat.name,
      sortOrder: cat.sortOrder ?? 0
    })).sort((a, b) => a.sortOrder - b.sortOrder)

    // Add uncategorized option if there's any equipment without category
    const hasUncategorized = data.some(equipment => !equipment.category)
    if (hasUncategorized) {
      options.push({
        value: "null",
        label: "Uncategorized",
        sortOrder: Number.MAX_SAFE_INTEGER
      })
    }

    return options.map(({ value, label }) => ({ value, label }))
  }, [categories, data])

  // Sync sorting state with URL params when they change
  React.useEffect(() => {
    setSorting([{
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc'
    }])
  }, [filters.sortBy, filters.sortOrder])

  // Handle sorting changes - navigate to update URL
  const handleSortingChange = React.useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    // Get the current sorting state from URL params (source of truth)
    const currentSorting: SortingState = [{
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc'
    }]

    const newSorting = typeof updaterOrValue === 'function' ? updaterOrValue(currentSorting) : updaterOrValue

    if (newSorting.length > 0) {
      const sort = newSorting[0]
      navigate({
        to: '.',
        search: {
          ...filters,
          sortBy: sort.id as any,
          sortOrder: sort.desc ? 'desc' : 'asc',
          page: 1,
        },
      })
    }
  }, [filters, navigate])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    enableSortingRemoval: false,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Handle filter changes
  const handleFilterChange = React.useCallback((filterId: string, value: string[] | undefined) => {
    const newFilters = { ...filters };

    if (filterId === 'category') {
      const categoryIds = value && value.length > 0
        ? value.filter(v => v !== "null").map(v => parseInt(v))
        : undefined
      newFilters.categoryIds = categoryIds && categoryIds.length > 0 ? categoryIds : undefined
    } else if (filterId === 'isActive') {
      newFilters.isActive = (value && value.length > 0) ? value.map(v => v === "true") : undefined
    }

    navigate({
      to: '.',
      search: {
        ...newFilters,
        page: 1,
      },
    })
  }, [filters, navigate])

  // Handle pagination changes
  const handlePageChange = React.useCallback((newPage: number) => {
    navigate({
      to: '.',
      search: { ...filters, page: newPage },
    })
  }, [filters, navigate])

  // Handle page size changes
  const handlePageSizeChange = React.useCallback((newPageSize: number) => {
    navigate({
      to: '.',
      search: { ...filters, limit: newPageSize, page: 1 },
    })
  }, [filters, navigate])

  const isFiltered = (filters.categoryIds && filters.categoryIds.length > 0) || (filters.isActive && filters.isActive.length > 0) || filters.searchQuery

  const clearAllFilters = React.useCallback(() => {
    navigate({
      to: '.',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'modelName',
        sortOrder: 'asc',
      },
    })
  }, [filters.limit, navigate])

  return (
    <div className="space-y-4">
      {/* Filters - Responsive layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <Input
            placeholder="Search equipment by name or description..."
            value={localSearchValue}
            onChange={(event) => setLocalSearchValue(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            {categoryOptions.length > 0 && (
              <DataTableFacetedFilter
                title="Category"
                options={categoryOptions}
                selectedValues={filters.categoryIds ? filters.categoryIds.map(id => id.toString()) : []}
                onSelectionChange={(values) => handleFilterChange('category', values)}
              />
            )}
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={filters.isActive ? filters.isActive.map(v => v.toString()) : []}
              onSelectionChange={(values) => handleFilterChange('isActive', values)}
            />
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table with horizontal scroll on small screens */}
      <div className="relative rounded-md border overflow-x-auto">
        {isLoading && <LoadingOverlay />}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination - Responsive layout */}
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {pagination.total} row(s) selected.
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium whitespace-nowrap">Rows per page</p>
            <Select
              value={`${pagination.limit}`}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pagination.limit} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between sm:justify-center gap-2">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}