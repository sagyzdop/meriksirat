import * as React from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Star,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { downloadPhotoFile } from '@/lib/albums/download'
import type { PhotoLightboxProps } from './types'
import { useZoom } from './use-zoom'
import { InfoPanel } from './info-panel'

const CHROME_TIMEOUT_MS = 3000

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  canManage = false,
  coverFileId = null,
  onSetCover,
  onDeletePhoto,
}: PhotoLightboxProps) {
  const photo = photos[index]
  const [chromeVisible, setChromeVisible] = React.useState(true)
  const [infoOpen, setInfoOpen] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const hideTimer = React.useRef<number | null>(null)

  const { scale, translate, resetZoom, zoomIn } = useZoom()

  // ── Chrome auto-hide ─────────────────────────────────

  const wakeChrome = React.useCallback(() => {
    setChromeVisible(true)
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      CHROME_TIMEOUT_MS
    )
  }, [])

  // ── Navigation ───────────────────────────────────────

  const prev = React.useCallback(
    () => onIndexChange((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndexChange]
  )
  const next = React.useCallback(
    () => onIndexChange((index + 1) % photos.length),
    [index, photos.length, onIndexChange]
  )

  // ── Effects ──────────────────────────────────────────

  React.useEffect(() => {
    resetZoom()
    setImgLoaded(false)
    setInfoOpen(false)
    setConfirmDelete(false)
    wakeChrome()
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    }
  }, [index, wakeChrome, resetZoom])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
      wakeChrome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose, wakeChrome])

  React.useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  // ── Download ─────────────────────────────────────────

  if (!photo) return null

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPhotoFile(photo)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not download photo'
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black"
      onMouseMove={wakeChrome}
      onTouchStart={wakeChrome}
    >
      {/* Image area */}
      <div className="relative h-full w-full overflow-hidden">
        {/* Thumbnail placeholder behind the full image */}
        {photo.thumbnailUrl && !imgLoaded && (
          <img
            src={photo.thumbnailUrl}
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          />
        )}
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.name}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          className={cn(
            'absolute inset-0 m-auto max-h-full max-w-full select-none object-contain transition-opacity duration-300',
            imgLoaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
          draggable={false}
        />
      </div>

      {/* Top chrome bar */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3 transition-opacity duration-300 sm:p-4',
          chromeVisible ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Back to album"
        >
          <ArrowLeft className="size-6" />
        </Button>
        <div className="pointer-events-auto flex items-center gap-1">
          {canManage && onSetCover && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
              disabled={coverFileId === photo.id}
              title={
                coverFileId === photo.id
                  ? 'This is the current cover'
                  : 'Set as album cover'
              }
              onClick={() => onSetCover(photo)}
            >
              <Star
                className="size-5"
                fill={coverFileId === photo.id ? 'currentColor' : 'none'}
              />
              Set as cover
            </Button>
          )}
          {canManage && onDeletePhoto && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-red-500/20 hover:text-red-400"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete photo"
            >
              <Trash2 className="size-6" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            disabled={downloading}
            onClick={handleDownload}
            aria-label="Download photo"
          >
            <Download className="size-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={scale > 1 ? resetZoom : zoomIn}
            aria-label={scale > 1 ? 'Zoom out' : 'Zoom in'}
          >
            {scale > 1 ? (
              <ZoomOut className="size-6" />
            ) : (
              <ZoomIn className="size-6" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setInfoOpen((o) => !o)}
            aria-label="Photo details"
          >
            <Info className="size-6" />
          </Button>
        </div>
      </div>

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className={cn(
              'absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition-opacity duration-300 hover:bg-black/70 sm:left-4 sm:p-3',
              chromeVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            <ChevronLeft className="size-7" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className={cn(
              'absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition-opacity duration-300 hover:bg-black/70 sm:right-4 sm:p-3',
              chromeVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            <ChevronRight className="size-7" />
          </button>
        </>
      )}

      {/* Info panel */}
      <InfoPanel
        photo={photo}
        index={index}
        total={photos.length}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete photo?</DialogTitle>
          <DialogDescription>
            This permanently removes &quot;{photo.name}&quot; from the album and
            your Drive storage.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (onDeletePhoto) onDeletePhoto(photo)
                setConfirmDelete(false)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export type { PhotoLightboxProps }
