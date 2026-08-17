import * as React from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AlbumPhoto } from '@/lib/albums'
import { downloadPhotoFile } from '@/lib/albums/download'
import { formatBytes, formatUtcDateTime } from '@/lib/format'
import 'photoswipe/style.css'

interface PhotoLightboxProps {
  photos: AlbumPhoto[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  canManage?: boolean
  coverFileId?: string | null
  onSetCover?: (photo: AlbumPhoto) => void
  onDeletePhoto?: (photo: AlbumPhoto) => void
}

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  coverFileId = null,
  onSetCover,
  onDeletePhoto,
}: PhotoLightboxProps) {
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lightboxRef = React.useRef<any>(null)
  const photosRef = React.useRef(photos)
  const infoPanelRef = React.useRef<HTMLDivElement | null>(null)

  photosRef.current = photos

  const currentPhoto = photos[index]

  const buildInfoContent = React.useCallback(
    (photo: AlbumPhoto, idx: number, total: number) => {
      const frag = document.createDocumentFragment()

      const header = document.createElement('div')
      header.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid rgba(255,255,255,0.1)'
      const title = document.createElement('h2')
      title.style.cssText = 'font-size:14px;font-weight:600;color:#fff'
      title.textContent = 'Details'
      const closeBtn = document.createElement('button')
      closeBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      closeBtn.style.cssText =
        'background:none;border:none;color:#fff;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center'
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.1)'
      })
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none'
      })
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        lightboxRef.current?.pswp?.close()
      })
      header.appendChild(title)
      header.appendChild(closeBtn)
      frag.appendChild(header)

      const body = document.createElement('div')
      body.style.cssText =
        'flex:1;overflow-y:auto;padding:16px;color:#fff;font-size:14px'

      const addField = (label: string, value: string) => {
        const d = document.createElement('div')
        d.style.cssText = 'margin-bottom:16px'
        d.innerHTML = `<div style="font-size:12px;color:#a1a1aa;font-weight:500">${label}</div><div style="margin-top:2px;word-break:break-word">${value}</div>`
        body.appendChild(d)
      }

      const addGrid = (fields: Array<{ label: string; value: string }>) => {
        const grid = document.createElement('div')
        grid.style.cssText =
          'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px'
        fields.forEach(({ label, value }) => {
          const cell = document.createElement('div')
          cell.innerHTML = `<div style="font-size:12px;color:#a1a1aa;font-weight:500">${label}</div><div style="margin-top:2px">${value}</div>`
          grid.appendChild(cell)
        })
        body.appendChild(grid)
      }

      addField('Name', photo.name)
      addGrid([
        { label: 'Photo', value: `${idx} of ${total}` },
        { label: 'Type', value: photo.mimeType },
        {
          label: 'Size',
          value: photo.size != null ? formatBytes(photo.size) : '—',
        },
        {
          label: 'Date',
          value: formatUtcDateTime(photo.capturedAt) || '—',
        },
      ])

      if (photo.exif) {
        const exif = photo.exif
        const sep = document.createElement('div')
        sep.style.cssText =
          'border-top:1px solid rgba(255,255,255,0.1);margin:8px 0 16px'
        body.appendChild(sep)

        const exifTitle = document.createElement('div')
        exifTitle.style.cssText =
          'font-size:12px;color:#a1a1aa;font-weight:500;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em'
        exifTitle.textContent = 'Camera Info'
        body.appendChild(exifTitle)

        if (exif.cameraMake || exif.cameraModel) {
          const make = exif.cameraMake || ''
          const model = exif.cameraModel || ''
          addField('Camera', [make, model].filter(Boolean).join(' '))
        }
        if (exif.focalLength != null)
          addField('Focal length', `${exif.focalLength}mm`)
        if (exif.aperture != null) addField('Aperture', `f/${exif.aperture}`)
        if (exif.exposureTime)
          addField('Shutter speed', `${exif.exposureTime}s`)
        if (exif.isoSpeed != null) addField('ISO', `ISO ${exif.isoSpeed}`)
        if (exif.whiteBalance) addField('White balance', exif.whiteBalance)
        if (exif.width != null && exif.height != null) {
          addField('Dimensions', `${exif.width} × ${exif.height}`)
        }
      }

      return frag
    },
    []
  )

  const updateInfoPanel = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pswp: any) => {
      const panel = infoPanelRef.current
      if (!panel || !pswp) return
      const idx = pswp.currIndex
      const photo = photosRef.current[idx]
      if (!photo) return
      const content = panel.querySelector(
        '[data-pswp-info-content]'
      ) as HTMLElement
      if (!content) return
      content.innerHTML = ''
      content.appendChild(
        buildInfoContent(photo, idx + 1, photosRef.current.length)
      )
    },
    [buildInfoContent]
  )

  React.useEffect(() => {
    let destroyed = false

    const openLightbox = async () => {
      const lightboxModule = await import('photoswipe/lightbox')
      if (destroyed) return

      const lightbox = new lightboxModule.default({
        dataSource: photos.map((p) => ({
          src: p.url,
          width: p.exif?.width || 1920,
          height: p.exif?.height || 1080,
          msrc: p.thumbnailUrl,
          alt: p.name,
        })),
        appendToEl: containerRef.current!,
        bgOpacity: 0.9,
        showHideAnimationType: 'zoom',
        loop: photos.length > 1,
        preload: [1, 2] as [number, number],
        arrowKeys: true,
        escKey: true,
        pinchToClose: true,
        closeOnVerticalDrag: true,
        zoom: true,
        counter: true,
        pswpModule: () => import('photoswipe'),
      })

      lightboxRef.current = lightbox

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lightbox.on('uiRegister', function (this: any) {
        const pswp = this.pswp
        if (!pswp) return

        pswp.ui.registerElement({
          name: 'album-back',
          appendTo: 'bar',
          order: 0,
          isButton: true,
          tagName: 'button',
          title: 'Back to album',
          ariaLabel: 'Back to album',
          onClick: () => pswp.close(),
        })

        pswp.ui.registerElement({
          name: 'album-cover',
          appendTo: 'bar',
          order: 2,
          isButton: true,
          tagName: 'button',
          title:
            coverFileId === photos[pswp.currIndex]?.id
              ? 'Current cover'
              : 'Set as album cover',
          ariaLabel: 'Set as album cover',
          onClick: () => {
            const photo = photosRef.current[pswp.currIndex]
            if (photo) onSetCover?.(photo)
          },
        })

        pswp.ui.registerElement({
          name: 'album-delete',
          appendTo: 'bar',
          order: 3,
          isButton: true,
          tagName: 'button',
          title: 'Delete photo',
          ariaLabel: 'Delete photo',
          onClick: () => setConfirmDelete(true),
        })

        pswp.ui.registerElement({
          name: 'album-download',
          appendTo: 'bar',
          order: 4,
          isButton: true,
          tagName: 'button',
          title: 'Download photo',
          ariaLabel: 'Download photo',
          onClick: async () => {
            const photo = photosRef.current[pswp.currIndex]
            if (!photo) return
            try {
              await downloadPhotoFile(photo)
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Could not download photo'
              )
            }
          },
        })

        pswp.ui.registerElement({
          name: 'album-info',
          appendTo: 'bar',
          order: 9,
          isButton: true,
          tagName: 'button',
          title: 'Photo details',
          ariaLabel: 'Photo details',
          onClick: () => {
            const panel = infoPanelRef.current
            if (!panel) return
            const isOpen = panel.style.display === 'flex'
            panel.style.display = isOpen ? 'none' : 'flex'
            if (!isOpen) updateInfoPanel(pswp)
          },
        })

        pswp.ui.registerElement({
          name: 'album-info-panel',
          appendTo: 'root',
          order: 0,
        })

        const panel = document.createElement('div')
        panel.setAttribute('data-pswp-info-panel', '')
        panel.style.cssText =
          'position:absolute;inset:0;z-index:40;display:none'
        panel.innerHTML = `
          <div data-pswp-info-backdrop style="position:absolute;inset:0;background:rgba(0,0,0,0.6)"></div>
          <div data-pswp-info-content style="position:absolute;inset-y-0;right:0;width:320px;max-width:100%;background:#18181b;display:flex;flex-direction:column;overflow:hidden"></div>
        `

        const backdrop = panel.querySelector(
          '[data-pswp-info-backdrop]'
        ) as HTMLElement
        backdrop.addEventListener('click', () => pswp.close())

        pswp.element?.appendChild(panel)
        infoPanelRef.current = panel
        updateInfoPanel(pswp)
      })

      lightbox.on('change', () => {
        const pswp = lightbox.pswp
        if (pswp) updateInfoPanel(pswp)
      })

      lightbox.on('close', () => {
        const pswp = lightbox.pswp
        if (pswp) {
          onIndexChange(pswp.currIndex)
        }
      })

      lightbox.on('destroy', () => {
        infoPanelRef.current = null
        lightboxRef.current = null
      })

      lightbox.init()
      lightbox.loadAndOpen(index)
    }

    openLightbox()

    return () => {
      destroyed = true
      const lb = lightboxRef.current
      if (lb) {
        lightboxRef.current = null
        infoPanelRef.current = null
        lb.destroy()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmDelete = React.useCallback(() => {
    const lb = lightboxRef.current
    const pswp = lb?.pswp
    if (!pswp) return
    const photo = photosRef.current[pswp.currIndex]
    if (photo && onDeletePhoto) onDeletePhoto(photo)
    setConfirmDelete(false)
    pswp.close()
  }, [onDeletePhoto])

  if (!currentPhoto) return null

  return (
    <>
      <div ref={containerRef} className="pswp-photo-lightbox" />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete photo?</DialogTitle>
          <DialogDescription>
            This permanently removes &quot;{currentPhoto.name}&quot; from the
            album and your Drive storage.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
