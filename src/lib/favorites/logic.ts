export interface FavoriteRef {
  photoId: string
  driveFileId: string
}

export interface FavoritablePhoto {
  id: string
  photoId?: string | null
}

function matches(photo: FavoritablePhoto, ref: FavoriteRef): boolean {
  return photo.photoId
    ? ref.photoId === photo.photoId
    : ref.driveFileId === photo.id
}

export function isPhotoFavorited(
  photo: FavoritablePhoto,
  refs: FavoriteRef[]
): boolean {
  return refs.some((r) => matches(photo, r))
}

export function applyFavoriteToggle(
  refs: FavoriteRef[],
  photo: FavoritablePhoto,
  favorite: boolean
): FavoriteRef[] {
  const without = refs.filter((r) => !matches(photo, r))
  if (!favorite) return without
  return [...without, { photoId: photo.photoId ?? '', driveFileId: photo.id }]
}
