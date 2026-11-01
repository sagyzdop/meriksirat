import type { AlbumPhoto } from '@/lib/albums'
import type { FavoritesControl } from '@/lib/favorites/use-album-favorites'

export interface PhotoLightboxProps {
  photos: AlbumPhoto[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  canManage?: boolean
  coverFileId?: string | null
  onSetCover?: (photo: AlbumPhoto) => void
  onDeletePhoto?: (photo: AlbumPhoto) => void
  favorites?: FavoritesControl
}
