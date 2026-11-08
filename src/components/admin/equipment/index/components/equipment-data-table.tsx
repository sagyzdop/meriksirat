import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableFacetedFilter } from '@/components/shared/data-table-faceted-filter'
import { ServerDataTablePagination } from '@/components/shared/data-table/server-data-table-pagination'
import { useServerTableSorting } from '@/components/shared/data-table/use-server-table-sorting'
import { BulkEditClearanceDialog } from '@/components/shared/bulk-edit-clearance-dialog'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { SearchInput } from '@/components/shared/search-input'
import { BulkDeleteDialog, BulkSelectDialog } from './equipment-bulk-dialogs'
import { Folder, Power, Shield, Trash2, X } from 'lucide-react'
import {
  EquipmentWithCategory,
  bulkUpdateEquipmentClearanceFn,
  bulkUpdateEquipmentCategoryFn,
  bulkUpdateEquipmentStatusFn,
  bulkDeleteEquipmentFn,
} from '@/lib/equipment'
import type { PageInfo } from '@/lib/pagination'

interface Filters {
  categoryIds?: number[]
  searchQuery?: string
  minClearanceLevel?: number
  maxClearanceLevel?: number
  clearanceLevels?: number[]
  isActive?: boolean[]
  page: number
  limit: number
  sortBy:
    | 'modelName'
    | 'category'
    | 'requiredClearanceLevel'
    | 'isActive'
    | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface EquipmentDataTableProps {
  columns: ColumnDef<EquipmentWithCategory>[]
  data: EquipmentWithCategory[]
  categories: { id: number; name: string; sortOrder: number | null }[]
  pagination: PageInfo
  filters: Filters
  isLoading?: boolean
}

// Static filter options - in a real app, categories would be fetched from the server
const statusOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const clearanceLevelOptions = [...Array(10)].map((_, i) => ({
  value: (i + 1).toString(),
  label: `Level ${i + 1}`,
}))

export function EquipmentDataTable({
  columns,
  data,
  categories,
  pagination,
  filters,
  isLoading = false,
}: EquipmentDataTableProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [rowSelection, setRowSelection] = React.useState({})
  const [bulkEditClearanceOpen, setBulkEditClearanceOpen] =
    React.useState(false)
  const [bulkCategoryOpen, setBulkCategoryOpen] = React.useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = React.useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )

  const { sorting, handleSortingChange } = useServerTableSorting(filters)

  // Get category options for filtering from pre-fetched categories
  const categoryOptions = React.useMemo(() => {
    const options = categories
      .map((cat) => ({
        value: cat.id.toString(),
        label: cat.name,
        sortOrder: cat.sortOrder ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)

    // Add uncategorized option if there's any equipment without category
    const hasUncategorized = data.some((equipment) => !equipment.category)
    if (hasUncategorized) {
      options.push({
        value: 'null',
        label: 'Uncategorized',
        sortOrder: Number.MAX_SAFE_INTEGER,
      })
    }

    return options.map(({ value, label }) => ({ value, label }))
  }, [categories, data])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
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
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Handle filter changes
  const handleFilterChange = React.useCallback(
    (filterId: string, value: string[] | undefined) => {
      const newFilters = { ...filters }

      if (filterId === 'category') {
        const categoryIds =
          value && value.length > 0
            ? value.filter((v) => v !== 'null').map((v) => parseInt(v))
            : undefined
        newFilters.categoryIds =
          categoryIds && categoryIds.length > 0 ? categoryIds : undefined
      } else if (filterId === 'clearanceLevels') {
        newFilters.clearanceLevels =
          value && value.length > 0 ? value.map(Number) : undefined
      } else if (filterId === 'isActive') {
        newFilters.isActive =
          value && value.length > 0 ? value.map((v) => v === 'true') : undefined
      }

      navigate({
        to: '.',
        search: {
          ...newFilters,
          page: 1,
        },
      })
    },
    [filters, navigate]
  )

  // Handle pagination changes
  const handlePageChange = React.useCallback(
    (newPage: number) => {
      navigate({
        to: '.',
        search: { ...filters, page: newPage },
      })
    },
    [filters, navigate]
  )

  // Handle page size changes
  const handlePageSizeChange = React.useCallback(
    (newPageSize: number) => {
      navigate({
        to: '.',
        search: { ...filters, limit: newPageSize, page: 1 },
      })
    },
    [filters, navigate]
  )

  const isFiltered =
    (filters.categoryIds && filters.categoryIds.length > 0) ||
    (filters.isActive && filters.isActive.length > 0) ||
    (filters.clearanceLevels && filters.clearanceLevels.length > 0) ||
    filters.searchQuery

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

  const selectedEquipmentIds = React.useMemo(() => {
    return Object.keys(rowSelection)
      .map((index) => data[parseInt(index)]?.id)
      .filter((id): id is number => id != null)
  }, [rowSelection, data])

  return (
    <div className="space-y-4">
      {/* Filters - Responsive layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-1">
          <SearchInput
            placeholder="Search equipment by name or description..."
            value={filters.searchQuery}
            onChange={(value) =>
              navigate({
                to: '.',
                search: {
                  ...filters,
                  searchQuery: value || undefined,
                  page: 1,
                },
              })
            }
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            {categoryOptions.length > 0 && (
              <DataTableFacetedFilter
                title="Category"
                options={categoryOptions}
                selectedValues={
                  filters.categoryIds
                    ? filters.categoryIds.map((id) => id.toString())
                    : []
                }
                onSelectionChange={(values) =>
                  handleFilterChange('category', values)
                }
              />
            )}
            <DataTableFacetedFilter
              title="Clearance Level"
              options={clearanceLevelOptions}
              selectedValues={
                filters.clearanceLevels
                  ? filters.clearanceLevels.map(String)
                  : []
              }
              onSelectionChange={(values) =>
                handleFilterChange('clearanceLevels', values)
              }
            />
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={
                filters.isActive
                  ? filters.isActive.map((v) => v.toString())
                  : []
              }
              onSelectionChange={(values) =>
                handleFilterChange('isActive', values)
              }
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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {selectedEquipmentIds.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full border-dashed sm:w-auto"
                onClick={() => setBulkEditClearanceOpen(true)}
              >
                <Shield className="mr-2 h-4 w-4" />
                Edit Clearance ({selectedEquipmentIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full border-dashed sm:w-auto"
                onClick={() => setBulkCategoryOpen(true)}
              >
                <Folder className="mr-2 h-4 w-4" />
                Edit Category ({selectedEquipmentIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full border-dashed sm:w-auto"
                onClick={() => setBulkStatusOpen(true)}
              >
                <Power className="mr-2 h-4 w-4" />
                Edit Status ({selectedEquipmentIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedEquipmentIds.length})
              </Button>
            </>
          )}
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
                    <TableHead
                      key={header.id}
                      className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap"
                    >
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
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (
                      target.closest(
                        'button, a, input, select, label, [role="combobox"]'
                      )
                    )
                      return
                    navigate({
                      to: '/admin/equipment/$equipmentId/edit',
                      params: { equipmentId: row.original.id.toString() },
                    })
                  }}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="[&:has([role=checkbox])]:pl-3 whitespace-nowrap"
                    >
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

      <ServerDataTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        limit={pagination.limit}
        selectedCount={selectedEquipmentIds.length}
        totalCount={pagination.total}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <BulkEditClearanceDialog
        open={bulkEditClearanceOpen}
        onOpenChange={setBulkEditClearanceOpen}
        count={selectedEquipmentIds.length}
        itemNoun="equipment item(s)"
        actionPhrase="update the required clearance level"
        successMessage={`Updated clearance level for ${selectedEquipmentIds.length} equipment item(s)`}
        errorTitle="Failed to update equipment"
        onSubmit={async (clearanceLevel) => {
          await bulkUpdateEquipmentClearanceFn({
            data: {
              equipmentIds: selectedEquipmentIds,
              requiredClearanceLevel: clearanceLevel,
            },
          })
        }}
        onSuccess={() => {
          setRowSelection({})
          queryClient.invalidateQueries({ queryKey: ['equipment'] })
        }}
      />

      <BulkSelectDialog
        open={bulkCategoryOpen}
        onOpenChange={setBulkCategoryOpen}
        count={selectedEquipmentIds.length}
        title="Bulk Edit Category"
        label="Category"
        placeholder="Select category"
        options={categories.map((c) => ({
          value: c.id.toString(),
          label: c.name,
        }))}
        successMessage={`Updated category for ${selectedEquipmentIds.length} equipment item(s)`}
        errorTitle="Failed to update equipment"
        onSubmit={async (value) => {
          await bulkUpdateEquipmentCategoryFn({
            data: {
              equipmentIds: selectedEquipmentIds,
              categoryId: parseInt(value),
            },
          })
        }}
        onSuccess={() => {
          setRowSelection({})
          queryClient.invalidateQueries({ queryKey: ['equipment'] })
        }}
      />

      <BulkSelectDialog
        open={bulkStatusOpen}
        onOpenChange={setBulkStatusOpen}
        count={selectedEquipmentIds.length}
        title="Bulk Edit Status"
        label="Status"
        placeholder="Select status"
        options={statusOptions}
        successMessage={`Updated status for ${selectedEquipmentIds.length} equipment item(s)`}
        errorTitle="Failed to update equipment"
        onSubmit={async (value) => {
          await bulkUpdateEquipmentStatusFn({
            data: {
              equipmentIds: selectedEquipmentIds,
              isActive: value === 'true',
            },
          })
        }}
        onSuccess={() => {
          setRowSelection({})
          queryClient.invalidateQueries({ queryKey: ['equipment'] })
        }}
      />

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedEquipmentIds.length}
        onSubmit={() =>
          bulkDeleteEquipmentFn({
            data: { equipmentIds: selectedEquipmentIds },
          })
        }
        onSuccess={() => {
          setRowSelection({})
          queryClient.invalidateQueries({ queryKey: ['equipment'] })
        }}
      />
    </div>
  )
}
