import * as React from 'react'
import {
  Download,
  ImageIcon,
  Star,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { AlbumPhoto } from '@/lib/albums'
import { downloadPhotoFile } from '@/lib/albums/download'
import { toast } from 'sonner'
import { PhotoImage } from './photo-image'
import { PhotoLightbox } from './photo-lightbox'

interface PhotoGridProps {
  photos: AlbumPhoto[]
  canManage?: boolean
  onSetCover?: (photo: AlbumPhoto) => void
  onDeletePhoto?: (photo: AlbumPhoto) => void
}

export function PhotoGrid({
  photos,
  canManage = false,
  onSetCover,
  onDeletePhoto,
}: PhotoGridProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<AlbumPhoto | null>(
    null
  )

  const open =
    lightboxIndex !== null &&
    lightboxIndex >= 0 &&
    lightboxIndex < photos.length
  const current = open ? photos[lightboxIndex!] : null

  const handleDownload = async (photo: AlbumPhoto) => {
    try {
      await downloadPhotoFile(photo)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not download photo'
      )
    }
  }

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
            {canManage && (
              <div
                className="pointer-events-none absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <div className="pointer-events-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="bg-background/80 backdrop-blur"
                        aria-label={`Actions for ${photo.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onSetCover && (
                        <DropdownMenuItem onClick={() => onSetCover(photo)}>
                          <Star />
                          Set as cover
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDownload(photo)}>
                        <Download />
                        Download
                      </DropdownMenuItem>
                      {onDeletePhoto && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setConfirmDelete(photo)}
                        >
                          <Trash2 />
                          Delete photo
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
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
        />
      )}

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogTitle>Delete photo?</DialogTitle>
          <DialogDescription>
            This permanently removes &quot;{confirmDelete?.name}&quot; from the
            album and your Drive storage.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete && onDeletePhoto) onDeletePhoto(confirmDelete)
                setConfirmDelete(null)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
