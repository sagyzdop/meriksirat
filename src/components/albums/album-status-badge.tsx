import { LifeBuoy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { albumStatus } from '@/lib/albums/status'

interface AlbumStatusBadgeProps {
  rescuedAt: Date | string | null
  scheduledDeletionAt: Date | string | null
  className?: string
}

export function AlbumStatusBadge({
  rescuedAt,
  scheduledDeletionAt,
  className,
}: AlbumStatusBadgeProps) {
  const status = albumStatus({ rescuedAt, scheduledDeletionAt })
  if (!status) return null
  if (status === 'scheduled_deletion') {
    return (
      <Badge variant="destructive" className={className}>
        <Trash2 />
        Scheduled for deletion
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={className}>
      <LifeBuoy />
      Rescued
    </Badge>
  )
}
