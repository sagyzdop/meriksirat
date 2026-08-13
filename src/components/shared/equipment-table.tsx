import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface EquipmentTableRow {
  key: string
  equipmentId: number
  title: string
  subtitle?: string | null
  imagePath?: string | null
  categoryName?: string | null
  action?: ReactNode
}

interface EquipmentTableProps {
  rows: EquipmentTableRow[]
  emptyMessage?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  className?: string
  onRowClick?: (equipmentId: number) => void
  actionColumn?: 'first' | 'last'
}

/**
 * EquipmentTable is the single shared table for rendering lists of equipment
 * across the app (booking creation, booking detail/edit, etc.). It renders a
 * bordered table with image, model name and category, plus an optional action
 * cell per row. Pass `onRowClick` to make rows navigate somewhere on click.
 */
export function EquipmentTable({
  rows,
  emptyMessage = 'No equipment',
  emptyDescription,
  emptyAction,
  className,
  onRowClick,
  actionColumn = 'last',
}: EquipmentTableProps) {
  const hasActions = rows.some((row) => row.action != null)

  if (rows.length === 0) {
    return (
      <div className={cn('relative rounded-md border py-12 text-center', className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
        {emptyDescription && (
          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-x-auto rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {hasActions && actionColumn === 'first' && (
              <TableHead className="whitespace-nowrap" />
            )}
            <TableHead className="whitespace-nowrap">Image</TableHead>
            <TableHead className="whitespace-nowrap">Model Name</TableHead>
            <TableHead className="whitespace-nowrap">Category</TableHead>
            {hasActions && actionColumn === 'last' && (
              <TableHead className="whitespace-nowrap" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              className={cn(onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(row.equipmentId) : undefined}
            >
              {hasActions && actionColumn === 'first' && (
                <TableCell
                  className="whitespace-nowrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.action}
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap">
                <img
                  src={
                    row.imagePath
                      ? `/api/images/${row.imagePath}`
                      : '/equipment-placeholder.svg'
                  }
                  alt={row.title}
                  className="h-10 w-14 rounded-md border object-cover"
                />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="font-medium">{row.title}</span>
                  {row.subtitle && (
                    <span className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {row.subtitle}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant="outline">
                  {row.categoryName ?? 'Uncategorized'}
                </Badge>
              </TableCell>
              {hasActions && actionColumn === 'last' && (
                <TableCell
                  className="whitespace-nowrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.action}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
