import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface EquipmentTableRow {
  key: string
  equipmentId: number
  title: string
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
}

/**
 * EquipmentTable is the single shared, header-less table for rendering lists
 * of equipment across the app (booking creation, booking detail/edit, booking
 * list collapsibles). Columns are: action, image, and name with a category
 * badge underneath. Rows navigate to the equipment detail page on click.
 */
export function EquipmentTable({
  rows,
  emptyMessage = 'No equipment',
  emptyDescription,
  emptyAction,
  className,
}: EquipmentTableProps) {
  const router = useRouter()

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'relative rounded-md border py-12 text-center',
          className
        )}
      >
        <p className="text-muted-foreground">{emptyMessage}</p>
        {emptyDescription && (
          <p className="mt-1 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        )}
        {emptyAction && (
          <div className="mt-4 flex justify-center">{emptyAction}</div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn('relative overflow-x-auto rounded-md border', className)}
    >
      <Table>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() =>
                router.navigate({
                  to: '/equipment/$',
                  params: { _splat: row.equipmentId.toString() },
                })
              }
            >
              <TableCell
                className="whitespace-nowrap"
                onClick={(event) => event.stopPropagation()}
              >
                {row.action}
              </TableCell>
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
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{row.title}</span>
                  <Badge
                    variant="outline"
                    className="w-fit text-xs text-muted-foreground"
                  >
                    {row.categoryName ?? 'Uncategorized'}
                  </Badge>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
