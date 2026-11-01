import * as React from 'react'
import { ImageIcon } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import type { AlbumPhoto } from '@/lib/albums'
import { FavoriteButton } from '@/components/shared/favorite-button'
import type { FavoritesControl } from '@/lib/favorites/use-album-favorites'
import { PhotoImage } from './photo-image'
import { PhotoLightbox } from './photo-lightbox'

interface PhotoGridProps {
  photos: AlbumPhoto[]
  canManage?: boolean
  coverFileId?: string | null
  onSetCover?: (photo: AlbumPhoto) => void
  onDeletePhoto?: (photo: AlbumPhoto) => void
  favorites?: FavoritesControl
}

export function PhotoGrid({
  photos,
  canManage = false,
  coverFileId = null,
  onSetCover,
  onDeletePhoto,
  favorites,
}: PhotoGridProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)

  const open =
    lightboxIndex !== null &&
    lightboxIndex >= 0 &&
    lightboxIndex < photos.length
  const current = open ? photos[lightboxIndex!] : null

  if (photos.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageIcon />
          </EmptyMedia>
          <EmptyTitle>No photos yet</EmptyTitle>
          <EmptyDescription>
            {canManage
              ? 'Use the upload button to add photos.'
              : 'This album has no photos yet.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-px sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setLightboxIndex(index)
              }
            }}
            className="group relative aspect-square cursor-pointer outline-none focus-visible:ring-ring/50 focus-visible:z-10 focus-visible:ring-[3px]"
          >
            <PhotoImage
              src={photo.thumbnailUrl}
              alt={photo.name}
              className="transition-transform duration-300 group-hover:scale-105"
            />
            {favorites && (
              <FavoriteButton
                favorited={favorites.isFavorite(photo)}
                onToggle={() => favorites.toggle(photo)}
                className={cn(
                  'absolute top-1 right-1 size-8 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white',
                  !favorites.isFavorite(photo) &&
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100'
                )}
                iconClassName="size-4"
              />
            )}
          </div>
        ))}
      </div>

      {open && current && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex!}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          canManage={canManage}
          coverFileId={coverFileId}
          onSetCover={onSetCover}
          onDeletePhoto={onDeletePhoto}
          favorites={favorites}
        />
      )}
    </>
  )
}
