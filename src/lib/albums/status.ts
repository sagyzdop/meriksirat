export type AlbumStatus =
  | 'healthy'
  | 'unhealthy'
  | 'rescued'
  | 'scheduled_deletion'
  | 'deleted'
  | 'lost'
export type AlbumStorageHolder = 'buffer' | 'flamekeeper' | 'none'

export const ALBUM_STATUSES = [
  'healthy',
  'unhealthy',
  'rescued',
  'scheduled_deletion',
  'deleted',
  'lost',
] as const satisfies readonly AlbumStatus[]

export const DEFAULT_ALBUM_STATUS_FILTER = [
  'healthy',
  'unhealthy',
  'rescued',
  'scheduled_deletion',
] as const satisfies readonly AlbumStatus[]

export function normalizeAlbumStatusFilter<
  T extends { status?: readonly AlbumStatus[] },
>(filters: T): T {
  if (filters.status && filters.status.length > 0) return filters
  return { ...filters, status: [...DEFAULT_ALBUM_STATUS_FILTER] }
}

export const ALBUM_STATUS_INFO: Record<
  AlbumStatus,
  { label: string; description: string }
> = {
  healthy: {
    label: 'Healthy',
    description: 'All photos are held safely. Nothing needs attention.',
  },
  unhealthy: {
    label: 'Unhealthy',
    description:
      'A flamekeeper holding some of the photos was lost or partially lost. The photos may disappear unless they are moved.',
  },
  rescued: {
    label: 'Rescued',
    description:
      'An admin moved the album out of danger. It is kept past its normal expiry.',
  },
  scheduled_deletion: {
    label: 'Scheduled for deletion',
    description:
      'The album will be deleted on its scheduled date unless the deletion is cancelled.',
  },
  deleted: {
    label: 'Deleted',
    description: 'The album and its photos were deleted.',
  },
  lost: {
    label: 'Lost',
    description:
      'The photos are gone: the flamekeeper holding them left or was lost, or the Drive folder was deleted.',
  },
}

const LOST_REASONS = ['flamekeeper_lost', 'flamekeeper_left', 'folder_deleted']

export interface AlbumStatusVolume {
  droppedAt?: Date | string | null
  flamekeeperState?: string | null
  flamekeeperLostSince?: Date | string | null
}

export function albumStatus(row: {
  deletedAt?: Date | string | null
  tombstoneReason?: string | null
  rescuedAt: Date | string | null
  scheduledDeletionAt: Date | string | null
  volumes?: AlbumStatusVolume[]
}): AlbumStatus {
  if (row.deletedAt) {
    return row.tombstoneReason && LOST_REASONS.includes(row.tombstoneReason)
      ? 'lost'
      : 'deleted'
  }
  if (row.scheduledDeletionAt) return 'scheduled_deletion'
  if (row.rescuedAt) return 'rescued'
  const unhealthy = (row.volumes ?? []).some(
    (v) =>
      !v.droppedAt &&
      (v.flamekeeperState === 'lost' || !!v.flamekeeperLostSince)
  )
  return unhealthy ? 'unhealthy' : 'healthy'
}

export function albumStorageHolder(
  volumes: { flamekeeperUserId: string | null; droppedAt?: Date | null }[]
): AlbumStorageHolder {
  const live = volumes.filter((v) => !v.droppedAt)
  if (live.some((v) => v.flamekeeperUserId)) return 'flamekeeper'
  if (live.length > 0) return 'buffer'
  return 'none'
}
