import { albumPhotoUrls } from './urls'
import type { AlbumPhoto, AlbumPhotoExif } from './types'

export const WRITES_PER_PHOTO = 3
export const ALBUM_TOTALS_WRITES = 1
export const DEFAULT_DAILY_WRITE_BUDGET = 60_000
export const MAX_PHOTOS_PER_RUN = 500
export const MAX_ALBUMS_PER_RUN = 5
export const PHOTO_INSERT_CHUNK = 6

export type IndexSkipReason = 'trashed' | 'missing'

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

export interface PhotoRowValues {
  id: string
  albumId: string
  driveFileId: string
  name: string
  bytes: number
  mimeType: string
  width: number | null
  height: number | null
  capturedAt: Date | null
  exif: string | null
  createdAt: Date
}

export interface PhotoRowLike {
  id?: string
  driveFileId: string
  name: string
  bytes: number
  mimeType: string
  width: number | null
  height: number | null
  capturedAt: Date | null
  exif: string | null
  createdAt: Date
}

export interface IndexCandidate {
  id: string
  sortTime: number
  requestedAt: number | null
}

export interface BudgetState {
  day: string
  spent: number
}

export function parseDailyWriteBudget(raw: string | undefined): number {
  if (!raw) return DEFAULT_DAILY_WRITE_BUDGET
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DAILY_WRITE_BUDGET
  return Math.floor(parsed)
}

export function budgetDayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function rollBudget(
  state: BudgetState | null,
  dayKey: string
): BudgetState {
  return state && state.day === dayKey ? state : { day: dayKey, spent: 0 }
}

export function recordSpend(state: BudgetState, writes: number): BudgetState {
  return { day: state.day, spent: state.spent + Math.max(0, writes) }
}

export function photoWriteCost(photoCount: number): number {
  return photoCount <= 0
    ? 0
    : photoCount * WRITES_PER_PHOTO + ALBUM_TOTALS_WRITES
}

export function photosAffordable(
  budget: number,
  spentToday: number,
  maxPerRun: number = MAX_PHOTOS_PER_RUN
): number {
  const remaining = budget - spentToday - ALBUM_TOTALS_WRITES
  if (remaining < WRITES_PER_PHOTO) return 0
  return Math.min(Math.floor(remaining / WRITES_PER_PHOTO), maxPerRun)
}

export function readsFromTable(album: {
  photosIndexedAt: Date | null
}): boolean {
  return album.photosIndexedAt !== null
}

export function selectNextAlbum(
  candidates: IndexCandidate[],
  exclude: ReadonlySet<string> = new Set()
): IndexCandidate | null {
  let best: IndexCandidate | null = null
  for (const c of candidates) {
    if (exclude.has(c.id)) continue
    if (!best || compareCandidates(c, best) < 0) best = c
  }
  return best
}

function compareCandidates(a: IndexCandidate, b: IndexCandidate): number {
  if (a.requestedAt !== null && b.requestedAt !== null) {
    if (a.requestedAt !== b.requestedAt) return a.requestedAt - b.requestedAt
  } else if (a.requestedAt !== null) {
    return -1
  } else if (b.requestedAt !== null) {
    return 1
  }
  return b.sortTime - a.sortTime
}

export function isImage(file: { mimeType?: string }): boolean {
  return !!file.mimeType?.startsWith('image/')
}

export function missingFromTable<T extends DriveFileLike>(
  driveFiles: T[],
  knownDriveFileIds: Iterable<string>
): T[] {
  const known = new Set(knownDriveFileIds)
  return driveFiles.filter((f) => isImage(f) && !known.has(f.id))
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

export function driveFileToPhotoValues(
  file: DriveFileLike,
  albumId: string,
  photoId: string,
  now: Date = new Date()
): PhotoRowValues {
  const meta = file.imageMediaMetadata
  const created = file.createdTime ? new Date(file.createdTime) : now
  const exif = pickExif(meta)
  return {
    id: photoId,
    albumId,
    driveFileId: file.id,
    name: file.name,
    bytes: file.size ? Number(file.size) || 0 : 0,
    mimeType: file.mimeType,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
    capturedAt: parseCapturedAt(meta?.time),
    exif: exif ? JSON.stringify(exif) : null,
    createdAt: Number.isNaN(created.getTime()) ? now : created,
  }
}

export function photoRowToAlbumPhoto(row: PhotoRowLike): AlbumPhoto {
  const { url, thumbnailUrl } = albumPhotoUrls(row.driveFileId)
  let exif: AlbumPhotoExif | undefined
  if (row.exif) {
    try {
      exif = JSON.parse(row.exif) as AlbumPhotoExif
    } catch {
      exif = undefined
    }
  }
  if (row.width != null || row.height != null) {
    exif = {
      ...exif,
      ...(row.width != null && { width: row.width }),
      ...(row.height != null && { height: row.height }),
    }
  }
  return {
    id: row.driveFileId,
    photoId: row.id ?? null,
    name: row.name,
    mimeType: row.mimeType,
    size: row.bytes,
    capturedAt: (row.capturedAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
    url,
    thumbnailUrl,
    ...(exif && { exif }),
  }
}

export function sortPhotosByCapture(photos: AlbumPhoto[]): AlbumPhoto[] {
  return [...photos].sort((a, b) => {
    if (a.capturedAt < b.capturedAt) return -1
    if (a.capturedAt > b.capturedAt) return 1
    return 0
  })
}

export function sumBytes(rows: { bytes: number }[]): number {
  let total = 0
  for (const r of rows) total += r.bytes
  return total
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}
