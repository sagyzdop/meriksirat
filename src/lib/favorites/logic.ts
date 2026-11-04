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
