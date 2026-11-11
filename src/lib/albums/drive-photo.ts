import type { AlbumPhoto, AlbumPhotoDetails, AlbumPhotoExif } from './types'

export interface DriveFileLike {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  imageMediaMetadata?: {
    time?: string
    cameraMake?: string
    cameraModel?: string
    exposureTime?: string
    aperture?: number
    focalLength?: number
    isoSpeed?: number
    width?: number
    height?: number
    whiteBalance?: string
  }
}

export function isImage(file: { mimeType?: string }): boolean {
  return !!file.mimeType?.startsWith('image/')
}

export function parseCapturedAt(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
    value
  )
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match
  const exifParsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
  return Number.isNaN(exifParsed.getTime()) ? null : exifParsed
}

export function pickExif(
  meta: DriveFileLike['imageMediaMetadata']
): AlbumPhotoExif | null {
  if (!meta) return null
  const out: AlbumPhotoExif = {
    ...(meta.cameraMake && { cameraMake: meta.cameraMake }),
    ...(meta.cameraModel && { cameraModel: meta.cameraModel }),
    ...(meta.exposureTime && { exposureTime: meta.exposureTime }),
    ...(meta.aperture != null && { aperture: meta.aperture }),
    ...(meta.focalLength != null && { focalLength: meta.focalLength }),
    ...(meta.isoSpeed != null && { isoSpeed: meta.isoSpeed }),
    ...(meta.whiteBalance && { whiteBalance: meta.whiteBalance }),
  }
  return Object.keys(out).length > 0 ? out : null
}

export function driveFileToAlbumPhoto(f: DriveFileLike): AlbumPhoto {
  const capturedAt =
    parseCapturedAt(f.imageMediaMetadata?.time)?.toISOString() ||
    f.createdTime ||
    ''
  return { id: f.id, name: f.name, capturedAt }
}

export function driveFileToPhotoDetails(f: DriveFileLike): AlbumPhotoDetails {
  const meta = f.imageMediaMetadata
  const exif = meta && {
    ...pickExif(meta),
    ...(meta.width != null && { width: meta.width }),
    ...(meta.height != null && { height: meta.height }),
  }
  return {
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : null,
    exif: exif && Object.keys(exif).length > 0 ? exif : null,
  }
}

export function sortPhotosByCapture(photos: AlbumPhoto[]): AlbumPhoto[] {
  return [...photos].sort((a, b) => {
    if (a.capturedAt < b.capturedAt) return -1
    if (a.capturedAt > b.capturedAt) return 1
    return 0
  })
}
