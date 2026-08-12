import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EquipmentWithCategory } from '@/lib/equipment'
import { Trash2 } from 'lucide-react'

interface SelectedEquipmentTableProps {
  equipment: EquipmentWithCategory[]
  onRemove: (equipmentId: number) => void
}

export function SelectedEquipmentTable({
  equipment,
  onRemove,
}: SelectedEquipmentTableProps) {
  if (equipment.length === 0) {
    return (
      <div className="relative rounded-md border py-12 text-center">
        <p className="text-muted-foreground">No equipment selected</p>
        <p className="text-sm text-muted-foreground mt-1">
          Please select equipment from the equipment page to continue
        </p>
      </div>
    )
  }

  return (
    <div className="relative rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Image</TableHead>
            <TableHead className="whitespace-nowrap">Model Name</TableHead>
            <TableHead className="whitespace-nowrap">Category</TableHead>
            <TableHead className="whitespace-nowrap" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap">
                <img
                  src={
                    item.imagePath
                      ? `/api/images/${item.imagePath}`
                      : '/equipment-placeholder.svg'
                  }
                  alt={item.modelName}
                  className="h-10 w-14 rounded-md border object-cover"
                />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="font-medium">{item.modelName}</span>
                  {item.description && (
                    <span className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant="outline">
                  {item.category?.name ?? 'Uncategorized'}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.modelName}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function SelectedEquipmentSectionActions() {
  return (
    <Link to="/equipment">
      <Button variant="outline">Add More</Button>
    </Link>
  )
}
