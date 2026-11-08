export interface FavoriteRef {
  driveFileId: string
}

export interface FavoritablePhoto {
  id: string
}

export function isPhotoFavorited(
  photo: FavoritablePhoto,
  refs: FavoriteRef[]
): boolean {
  return refs.some((r) => r.driveFileId === photo.id)
}

export function applyFavoriteToggle(
  refs: FavoriteRef[],
  photo: FavoritablePhoto,
  favorite: boolean
): FavoriteRef[] {
  const without = refs.filter((r) => r.driveFileId !== photo.id)
  if (!favorite) return without
  return [...without, { driveFileId: photo.id }]
}

export function isAlbumHearted(albumId: string, ids: string[]): boolean {
  return ids.includes(albumId)
}

export function applyAlbumHeartToggle(
  ids: string[],
  albumId: string,
  hearted: boolean
): string[] {
  const without = ids.filter((id) => id !== albumId)
  return hearted ? [...without, albumId] : without
}

export function adjustHeartCount(count: number, delta: number): number {
  return Math.max(count + delta, 0)
}

type CountedAlbum = { id: string; heartCount: number }

function isCountedAlbum(value: unknown): value is CountedAlbum {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CountedAlbum).id === 'string' &&
    typeof (value as CountedAlbum).heartCount === 'number'
  )
}

export function patchHeartCount<T>(data: T, albumId: string, delta: number): T {
  if (Array.isArray(data)) {
    return data.map((item) => patchHeartCount(item, albumId, delta)) as T
  }
  if (isCountedAlbum(data)) {
    return data.id === albumId
      ? { ...data, heartCount: adjustHeartCount(data.heartCount, delta) }
      : data
  }
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        patchHeartCount(value, albumId, delta),
      ])
    ) as T
  }
  return data
}
