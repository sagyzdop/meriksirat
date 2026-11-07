import { Flame, HardDrive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AlbumStorage } from '@/lib/albums/types'

interface AlbumStorageBadgeProps {
  storage: AlbumStorage
  className?: string
}

export function AlbumStorageBadge({
  storage,
  className,
}: AlbumStorageBadgeProps) {
  if (storage.holder === 'none') return null
  if (storage.holder === 'flamekeeper') {
    return (
      <Badge variant="outline" className={className}>
        <Flame />
        {storage.flamekeeperName ?? 'Flamekeeper'}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={className}>
      <HardDrive />
      Buffer
    </Badge>
  )
}
