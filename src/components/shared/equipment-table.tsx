import type { ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

function EquipmentRowThumb({
  imagePath,
  title,
}: {
  imagePath?: string | null
  title: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const showPlaceholder = imageFailed || !imagePath

  if (showPlaceholder) {
    return (
      <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
        <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
      </div>
    )
  }

  return (
    <img
      src={`/api/images/${imagePath}`}
      alt={title}
      onError={() => setImageFailed(true)}
      className="h-10 w-14 shrink-0 rounded-md border object-cover"
    />
  )
}

/**
 * EquipmentTable renders lists of equipment as card rows across the app
 * (booking creation, booking detail/edit, booking list collapsibles). Each row
 * is a fixed-layout flex card (image, title with category badge, action) so the
 * columns never drift regardless of action or content width. Rows navigate to
 * the equipment detail page on click.
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
    <div className={cn('space-y-2', className)}>
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex cursor-pointer items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
          onClick={() =>
            router.navigate({
              to: '/equipment/$',
              params: { _splat: row.equipmentId.toString() },
            })
          }
        >
          <EquipmentRowThumb imagePath={row.imagePath} title={row.title} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{row.title}</p>
            <Badge
              variant="outline"
              className="mt-1 w-fit text-xs text-muted-foreground"
            >
              {row.categoryName ?? 'Uncategorized'}
            </Badge>
          </div>
          {row.action && (
            <div
              className="shrink-0"
              onClick={(event) => event.stopPropagation()}
            >
              {row.action}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
