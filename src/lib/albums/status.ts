export type AlbumStatus = 'rescued' | 'scheduled_deletion'
export type AlbumStorageHolder = 'buffer' | 'flamekeeper' | 'none'

export function albumStatus(row: {
  rescuedAt: Date | string | null
  scheduledDeletionAt: Date | string | null
}): AlbumStatus | null {
  if (row.scheduledDeletionAt) return 'scheduled_deletion'
  if (row.rescuedAt) return 'rescued'
  return null
}

export function albumStorageHolder(
  volumes: { flamekeeperUserId: string | null; droppedAt?: Date | null }[]
): AlbumStorageHolder {
  const live = volumes.filter((v) => !v.droppedAt)
  if (live.some((v) => v.flamekeeperUserId)) return 'flamekeeper'
  if (live.length > 0) return 'buffer'
  return 'none'
}
