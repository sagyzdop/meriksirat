import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  OnChangeFn,
} from "@tanstack/react-table"
import { useRouter, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Edit, Trash2, ArrowUpDown, GripVertical } from "lucide-react"
import { CategoryWithCount } from ".."
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { updateCategorySortOrderFn } from '@/lib/admin'
import { toast } from 'sonner'

interface CategoryDataTableProps {
  categories: CategoryWithCount[]
  onEdit: (category: CategoryWithCount) => void
  onDelete: (category: CategoryWithCount) => void
  sortBy?: 'name' | 'sortOrder' | 'equipmentCount'
  order?: 'asc' | 'desc'
}

// Sortable row component for drag and drop
function SortableRow({
  category,
  onEdit,
  onDelete,
  disabled
}: {
  category: CategoryWithCount
  onEdit: (category: CategoryWithCount) => void
  onDelete: (category: CategoryWithCount) => void
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/50" : ""}
    >
      <TableCell className="w-[40px]">
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded ${disabled ? 'opacity-20 cursor-not-allowed' : ''}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell className="max-w-[300px]">
        {category.description ? (
          <span className="text-sm text-muted-foreground truncate block">
            {category.description}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground italic">No description</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-mono">
          {category.sortOrder}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {category.equipmentCount} {category.equipmentCount === 1 ? 'item' : 'items'}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(category)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function CategoryDataTable({ categories, onEdit, onDelete, sortBy, order }: CategoryDataTableProps) {
  const router = useRouter()
  const navigate = useNavigate()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: sortBy || 'sortOrder', desc: order === 'desc' }
  ])
  const [sortedCategories, setSortedCategories] = React.useState(categories)
  const [isUpdatingSortOrder, setIsUpdatingSortOrder] = React.useState(false)

  // Update sorted categories when categories prop changes
  React.useEffect(() => {
    setSortedCategories(categories)
  }, [categories])

  // Sync sorting state with props
  React.useEffect(() => {
    setSorting([{ id: sortBy || 'sortOrder', desc: order === 'desc' }])
  }, [sortBy, order])

  const handleSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
    const newSorting = typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue
    setSorting(newSorting)

    if (newSorting.length > 0) {
      const { id, desc } = newSorting[0]
      navigate({
        search: (prev: any) => ({ ...prev, sortBy: id, order: desc ? 'desc' : 'asc' }) as any
      })
    } else {
      // Default sort
      navigate({
        search: (prev: any) => ({ ...prev, sortBy: 'sortOrder', order: 'asc' }) as any
      })
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: any) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = sortedCategories.findIndex(item => item.id === active.id)
      const newIndex = sortedCategories.findIndex(item => item.id === over.id)

      const newOrder = arrayMove(sortedCategories, oldIndex, newIndex)
      setSortedCategories(newOrder)

      // Update sort order on server
      setIsUpdatingSortOrder(true)
      try {
        const categoryUpdates = newOrder.map((cat, index) => ({
          id: cat.id,
          sortOrder: index
        }))

        await updateCategorySortOrderFn({
          data: { categoryUpdates }
        })

        toast.success('Category order updated successfully')

        // Refresh the page data to get the updated sort order
        router.invalidate()
      } catch (error) {
        console.error('Failed to update category sort order:', error)
        toast.error('Failed to update category order')

        // Revert the local state on error
        setSortedCategories([...categories].sort((a, b) => a.sortOrder - b.sortOrder))
      } finally {
        setIsUpdatingSortOrder(false)
      }
    }
  }

  const columns: ColumnDef<CategoryWithCount>[] = [
    {
      id: "drag",
      header: "",
      cell: () => null, // Handled by SortableRow
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      enableSorting: false,
    },
    {
      accessorKey: "sortOrder",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Sort Order
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: "equipmentCount",
      header: "Equipment Count",
      enableSorting: false,
    },
    {
      id: "actions",
      header: "Actions",
      cell: () => null, // Handled by SortableRow
      enableSorting: false,
    },
  ]

  const table = useReactTable({
    data: sortedCategories,
    columns,
    state: {
      sorting,
    },
    manualSorting: true,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const isDragEnabled = !sortBy || sortBy === 'sortOrder' && (!order || order === 'asc')

  return (
    <div className="space-y-4">
      {/* Table with horizontal scroll on small screens */}
      <div className="rounded-md border overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isDragEnabled ? (
                <SortableContext
                  items={sortedCategories.map(cat => cat.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedCategories.length ? (
                    sortedCategories.map((category) => (
                      <SortableRow
                        key={category.id}
                        category={category}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No categories found.
                      </TableCell>
                    </TableRow>
                  )}
                </SortableContext>
              ) : (
                <>
                  {sortedCategories.length ? (
                    sortedCategories.map((category) => (
                      // If DnD is disabled, we still use SortableRow but with disabled listener? 
                      // Or just render a regular row? SortableRow has hooks that might fail if not in SortableContext.
                      // Actually, we can just use SortableRow but disable the drag handle visually or functionally.
                      // But SortableRow calls useSortable. If separate, better use a different Row component or conditional hooks.
                      // For simplicity, I'll wrap in SortableContext anyway but maybe pass a prop to disable drag?
                      // Or I'll just refrain from using DndContext if disabled?
                      // If provided items to SortableContext but no DndContext ... ?
                      // Let's keep SortableContext but maybe modify SortableRow to hide handle if regular sort is active.
                      // But for now, let's just make it NOT draggable if conditional.

                      // Re-structuring:
                      // I will keep the DndContext wrapping but use `disabled` attribute on `useSortable` in `SortableRow`?
                      // `SortableRow` takes `category`. I can pass `isDragEnabled`.

                      <SortableRow
                        key={category.id}
                        category={category}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        disabled={!isDragEnabled}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No categories found.
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
        <span>
          {sortedCategories.length} {sortedCategories.length === 1 ? 'category' : 'categories'} total
        </span>
        {isUpdatingSortOrder && (
          <span className="text-blue-600">Updating sort order...</span>
        )}
      </div>
    </div>
  )
}