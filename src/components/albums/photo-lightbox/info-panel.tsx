import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AlbumPhoto } from '@/lib/albums'
import { formatBytes, formatUtcDateTime } from '@/lib/format'

interface InfoPanelProps {
  photo: AlbumPhoto
  index: number
  total: number
  open: boolean
  onClose: () => void
}

export function InfoPanel({
  photo,
  index,
  total,
  open,
  onClose,
}: InfoPanelProps) {
  const exif = photo.exif
  if (!open) return null

  return (
    <>
      <div
        className="absolute inset-0 z-20 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70vh] flex-col bg-zinc-900 text-white md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-80">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
          <h2 className="truncate text-sm font-semibold">Details</h2>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
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
              <div className="text-xs font-medium text-zinc-400">Photo</div>
              <div className="mt-0.5">
                {index + 1} of {total}
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
              <div className="text-xs font-medium text-zinc-400">Date</div>
              <div className="mt-0.5">
                {formatUtcDateTime(photo.capturedAt) || '—'}
              </div>
            </div>
          </div>

          {exif && (
            <>
              <div className="border-t border-white/10" />
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Camera Info
              </div>
              {(exif.cameraMake || exif.cameraModel) && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Camera
                  </div>
                  <div className="mt-0.5">
                    {[exif.cameraMake, exif.cameraModel]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                </div>
              )}
              {exif.focalLength != null && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Focal length
                  </div>
                  <div className="mt-0.5">{exif.focalLength}mm</div>
                </div>
              )}
              {exif.aperture != null && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Aperture
                  </div>
                  <div className="mt-0.5">f/{exif.aperture}</div>
                </div>
              )}
              {exif.exposureTime && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Shutter speed
                  </div>
                  <div className="mt-0.5">
                    {(() => {
                      const t = parseFloat(exif.exposureTime)
                      if (isNaN(t)) return exif.exposureTime
                      return t < 1 ? `1/${Math.round(1 / t)}` : `${t}"`
                    })()}
                  </div>
                </div>
              )}
              {exif.isoSpeed != null && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">ISO</div>
                  <div className="mt-0.5">ISO {exif.isoSpeed}</div>
                </div>
              )}
              {exif.whiteBalance && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    White balance
                  </div>
                  <div className="mt-0.5">{exif.whiteBalance}</div>
                </div>
              )}
              {exif.width != null && exif.height != null && (
                <div>
                  <div className="text-xs font-medium text-zinc-400">
                    Dimensions
                  </div>
                  <div className="mt-0.5">
                    {exif.width} × {exif.height}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
