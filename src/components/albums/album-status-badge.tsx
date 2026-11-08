import {
  CircleAlert,
  CircleCheck,
  LifeBuoy,
  Skull,
  Trash,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ALBUM_STATUS_INFO } from '@/lib/albums/status'
import type { AlbumStatus } from '@/lib/albums/status'

interface AlbumStatusBadgeProps {
  status: AlbumStatus
  className?: string
}

const config: Record<
  AlbumStatus,
  { variant: 'secondary' | 'destructive' | 'outline'; icon: LucideIcon }
> = {
  healthy: { variant: 'outline', icon: CircleCheck },
  unhealthy: { variant: 'destructive', icon: CircleAlert },
  rescued: { variant: 'secondary', icon: LifeBuoy },
  scheduled_deletion: { variant: 'destructive', icon: Trash2 },
  deleted: { variant: 'secondary', icon: Trash },
  lost: { variant: 'destructive', icon: Skull },
}

export function AlbumStatusBadge({ status, className }: AlbumStatusBadgeProps) {
  const { variant, icon: Icon } = config[status]
  return (
    <Badge variant={variant} className={className}>
      <Icon />
      {ALBUM_STATUS_INFO[status].label}
    </Badge>
  )
}
