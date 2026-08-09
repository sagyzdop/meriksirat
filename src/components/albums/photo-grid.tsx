import * as React from 'react'
import { ImageIcon } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { AlbumPhoto } from '@/lib/albums'
import { PhotoImage } from './photo-image'
import { PhotoLightbox } from './photo-lightbox'

interface PhotoGridProps {
  photos: AlbumPhoto[]
  canManage?: boolean
  coverFileId?: string | null
  onSetCover?: (photo: AlbumPhoto) => void
  onDeletePhoto?: (photo: AlbumPhoto) => void
}

export function PhotoGrid({
  photos,
  canManage = false,
  coverFileId = null,
  onSetCover,
  onDeletePhoto,
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
        />
      )}
    </>
  )
}
