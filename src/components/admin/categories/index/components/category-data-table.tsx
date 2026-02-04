import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useRouter } from "@tanstack/react-router"
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
import { MoreHorizontal, Edit, Trash2, GripVertical } from "lucide-react"
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
}

// Sortable row component for drag and drop
function SortableRow({
  category,
  onEdit,
  onDelete
}: {
  category: CategoryWithCount
  onEdit: (category: CategoryWithCount) => void
  onDelete: (category: CategoryWithCount) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

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
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
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

export function CategoryDataTable({ categories, onEdit, onDelete }: CategoryDataTableProps) {
  const router = useRouter()
  const [sortedCategories, setSortedCategories] = React.useState(categories)
  const [isUpdatingSortOrder, setIsUpdatingSortOrder] = React.useState(false)

  // Update sorted categories when categories prop changes
  React.useEffect(() => {
    setSortedCategories([...categories].sort((a, b) => a.sortOrder - b.sortOrder))
  }, [categories])

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
      } catch {
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
      header: "Name",
    },
    {
      accessorKey: "description",
      header: "Description",
      enableSorting: false,
    },
    {
      accessorKey: "sortOrder",
      header: "Sort Order",
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
    getCoreRowModel: getCoreRowModel(),
  })

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