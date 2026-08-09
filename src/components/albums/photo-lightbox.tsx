import * as React from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AlbumPhoto } from '@/lib/albums'
import { downloadPhotoFile } from '@/lib/albums/download'
import { formatBytes, formatUtcDate } from '@/lib/format'
import { PhotoImage } from './photo-image'

interface PhotoLightboxProps {
  photos: AlbumPhoto[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

const CHROME_TIMEOUT_MS = 3000

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const photo = photos[index]
  const [chromeVisible, setChromeVisible] = React.useState(true)
  const [infoOpen, setInfoOpen] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)
  const hideTimer = React.useRef<number | null>(null)

  const wakeChrome = React.useCallback(() => {
    setChromeVisible(true)
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      CHROME_TIMEOUT_MS
    )
  }, [])

  const prev = React.useCallback(
    () => onIndexChange((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndexChange]
  )
  const next = React.useCallback(
    () => onIndexChange((index + 1) % photos.length),
    [index, photos.length, onIndexChange]
  )

  React.useEffect(() => {
    setInfoOpen(false)
    wakeChrome()
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    }
  }, [index, wakeChrome])

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
      <PhotoImage
        src={photo.url}
        alt={photo.name}
        fit="contain"
        containerClassName="bg-transparent h-full w-full p-3 sm:p-10"
        className="max-h-full max-w-full object-contain"
        onClick={() => setChromeVisible((v) => !v)}
      />

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
            onClick={() => setInfoOpen((o) => !o)}
            aria-label="Photo details"
          >
            <Info className="size-6" />
          </Button>
        </div>
      </div>

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

      {infoOpen && (
        <>
          <div
            className="absolute inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setInfoOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70vh] flex-col bg-zinc-900 text-white md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-80">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
              <h2 className="truncate text-sm font-semibold">Details</h2>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-white hover:bg-white/10 hover:text-white"
                onClick={() => setInfoOpen(false)}
                aria-label="Close details"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <div>
                <div className="text-xs font-medium text-zinc-400">Name</div>
                <div className="mt-0.5 break-words">{photo.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Photo
                  </div>
                  <div className="mt-0.5">
                    {index + 1} of {photos.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-400">Type</div>
                  <div className="mt-0.5 break-words">{photo.mimeType}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-400">Size</div>
                  <div className="mt-0.5">
                    {photo.size != null ? formatBytes(photo.size) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Date
                  </div>
                  <div className="mt-0.5">
                    {formatUtcDate(photo.capturedAt) || '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
