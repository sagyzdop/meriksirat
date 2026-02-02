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
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useNavigate } from "@tanstack/react-router"

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
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'manager' | 'admin' | null
  clearanceLevel: number | null
  status: 'Active' | 'Inactive' | 'On Probation' | 'Board' | 'Ex-Board' | 'Roommate' | 'Ex-Roommate' | 'Graduated' | null
  firstName: string | null
  lastName: string | null
  createdAt: Date
  updatedAt: Date
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface Filters {
  role?: 'user' | 'manager' | 'admin'
  status?: 'Active' | 'Inactive' | 'On Probation' | 'Board' | 'Ex-Board' | 'Roommate' | 'Ex-Roommate' | 'Graduated'
  clearanceLevel?: number
  search?: string
  page: number
  limit: number
  sortBy: 'name' | 'email' | 'role' | 'status' | 'clearanceLevel' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface UserDataTableProps {
  columns: ColumnDef<User>[]
  data: User[]
  pagination: Pagination
  filters: Filters
}

const roleOptions = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
]

const statusOptions = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "On Probation", label: "On Probation" },
  { value: "Board", label: "Board" },
  { value: "Ex-Board", label: "Ex-Board" },
  { value: "Roommate", label: "Roommate" },
  { value: "Ex-Roommate", label: "Ex-Roommate" },
  { value: "Graduated", label: "Graduated" },
]

const clearanceLevelOptions = [
  { value: "1", label: "Level 1" },
  { value: "2", label: "Level 2" },
  { value: "3", label: "Level 3" },
  { value: "4", label: "Level 4" },
  { value: "5", label: "Level 5" },
]

export function UserDataTable({ columns, data, pagination, filters }: UserDataTableProps) {
  const navigate = useNavigate()
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])

  // Initialize filters from URL params
  React.useEffect(() => {
    const initialFilters: ColumnFiltersState = []
    
    if (filters.role) {
      initialFilters.push({ id: "role", value: [filters.role] })
    }
    
    if (filters.status) {
      initialFilters.push({ id: "status", value: [filters.status] })
    }
    
    if (filters.clearanceLevel) {
      initialFilters.push({ id: "clearanceLevel", value: [filters.clearanceLevel.toString()] })
    }
    
    if (filters.search) {
      initialFilters.push({ id: "name", value: filters.search })
      initialFilters.push({ id: "email", value: filters.search })
    }
    
    setColumnFilters(initialFilters)
    
    // Set initial sorting
    setSorting([{
      id: filters.sortBy,
      desc: filters.sortOrder === 'desc'
    }])
  }, [filters])

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
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Handle search input changes
  const handleSearchChange = React.useCallback((value: string) => {
    const newFilters = { ...filters }
    if (value) {
      newFilters.search = value
    } else {
      delete newFilters.search
    }
    newFilters.page = 1 // Reset to first page
    
    navigate({
      to: '/admin/users',
      search: newFilters,
    })
  }, [filters, navigate])

  // Handle filter changes
  const handleFilterChange = React.useCallback((filterId: string, value: string[] | undefined) => {
    const newFilters = { ...filters }
    
    if (filterId === 'role') {
      if (value && value.length > 0) {
        newFilters.role = value[0] as any
      } else {
        delete newFilters.role
      }
    } else if (filterId === 'status') {
      if (value && value.length > 0) {
        newFilters.status = value[0] as any
      } else {
        delete newFilters.status
      }
    } else if (filterId === 'clearanceLevel') {
      if (value && value.length > 0) {
        newFilters.clearanceLevel = parseInt(value[0])
      } else {
        delete newFilters.clearanceLevel
      }
    }
    
    newFilters.page = 1 // Reset to first page
    
    navigate({
      to: '/admin/users',
      search: newFilters,
    })
  }, [filters, navigate])

  // Handle pagination changes
  const handlePageChange = React.useCallback((newPage: number) => {
    navigate({
      to: '/admin/users',
      search: { ...filters, page: newPage },
    })
  }, [filters, navigate])

  // Handle page size changes
  const handlePageSizeChange = React.useCallback((newPageSize: number) => {
    navigate({
      to: '/admin/users',
      search: { ...filters, limit: newPageSize, page: 1 },
    })
  }, [filters, navigate])

  // Handle sorting changes
  React.useEffect(() => {
    if (sorting.length > 0) {
      const sort = sorting[0]
      const newFilters = {
        ...filters,
        sortBy: sort.id as any,
        sortOrder: sort.desc ? 'desc' as const : 'asc' as const,
        page: 1, // Reset to first page
      }
      
      navigate({
        to: '/admin/users',
        search: newFilters,
      })
    }
  }, [sorting])

  const isFiltered = filters.role || filters.status || filters.clearanceLevel || filters.search

  const clearAllFilters = React.useCallback(() => {
    navigate({
      to: '/admin/users',
      search: {
        page: 1,
        limit: filters.limit,
        sortBy: 'name',
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
            placeholder="Search users by name or email..."
            value={filters.search || ""}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="h-8 w-full sm:w-[200px] lg:w-[300px]"
          />
          <div className="flex flex-wrap gap-2">
            <DataTableFacetedFilter
              title="Role"
              options={roleOptions}
              selectedValues={filters.role ? [filters.role] : []}
              onSelectionChange={(values) => handleFilterChange('role', values)}
            />
            <DataTableFacetedFilter
              title="Status"
              options={statusOptions}
              selectedValues={filters.status ? [filters.status] : []}
              onSelectionChange={(values) => handleFilterChange('status', values)}
            />
            <DataTableFacetedFilter
              title="Clearance Level"
              options={clearanceLevelOptions}
              selectedValues={filters.clearanceLevel ? [filters.clearanceLevel.toString()] : []}
              onSelectionChange={(values) => handleFilterChange('clearanceLevel', values)}
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
      
      {/* Table with horizontal scroll on small screens */}
      <div className="rounded-md border overflow-x-auto">
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
          {pagination.totalCount} row(s) selected.
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