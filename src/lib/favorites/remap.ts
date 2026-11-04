import { albumPhotoUrls } from '@/lib/albums/urls'
import { driveFileToAlbumPhoto } from '@/lib/albums/drive-photo'
import type { DriveFileLike } from '@/lib/albums/drive-photo'
import type { FavoritePhoto } from './types'

export interface RemapInput {
  favorites: { userId: string; driveFileId: string }[]
  coverFileId: string | null
  oldFileId: string
  newFileId: string
}

export interface RemapPlan {
  move: string[]
  drop: string[]
  coverFileId: string | null
}

export function planRemap(input: RemapInput): RemapPlan {
  const { oldFileId, newFileId } = input
  if (oldFileId === newFileId) {
    return { move: [], drop: [], coverFileId: input.coverFileId }
  }
  const hasNew = new Set(
    input.favorites
      .filter((f) => f.driveFileId === newFileId)
      .map((f) => f.userId)
  )
  const move: string[] = []
  const drop: string[] = []
  for (const f of input.favorites) {
    if (f.driveFileId !== oldFileId) continue
    if (hasNew.has(f.userId)) drop.push(f.userId)
    else move.push(f.userId)
  }
  return {
    move,
    drop,
    coverFileId:
      input.coverFileId === oldFileId ? newFileId : input.coverFileId,
  }
}

export interface FavoriteRow {
  albumId: string
  albumTitle: string
  driveFileId: string
  favoritedAt: Date
}

export interface CachedAlbumFiles {
  complete: boolean
  files: DriveFileLike[]
}

export function albumsToRead(
  favorites: { albumId: string }[],
  limit: number
): string[] {
  const seen: string[] = []
  for (const f of favorites) {
    if (seen.length >= limit) break
    if (!seen.includes(f.albumId)) seen.push(f.albumId)
  }
  return seen
}

export function planFavoriteList(input: {
  favorites: FavoriteRow[]
  listings: Record<string, CachedAlbumFiles | undefined>
}): FavoritePhoto[] {
  const byAlbum = new Map<string, Map<string, DriveFileLike>>()
  for (const [albumId, listing] of Object.entries(input.listings)) {
    if (listing) {
      byAlbum.set(albumId, new Map(listing.files.map((f) => [f.id, f])))
    }
  }
  const photos: FavoritePhoto[] = []
  for (const f of input.favorites) {
    const listing = input.listings[f.albumId]
    const listed = byAlbum.get(f.albumId)?.get(f.driveFileId)
    const base = {
      albumId: f.albumId,
      albumTitle: f.albumTitle,
      favoritedAt: f.favoritedAt.toISOString(),
    }
    if (listed) {
      photos.push({ ...driveFileToAlbumPhoto(listed), ...base })
    } else if (!listing?.complete) {
      photos.push({
        id: f.driveFileId,
        name: 'Photo',
        mimeType: 'image/jpeg',
        size: null,
        capturedAt: base.favoritedAt,
        ...albumPhotoUrls(f.driveFileId),
        ...base,
      })
    }
  }
  return photos
}
