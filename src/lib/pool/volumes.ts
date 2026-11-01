export const RELEASE_RETRY_MS = 6 * 60 * 60 * 1000

export interface ReleaseVolume {
  albumId: string
  driveFolderId: string | null
  permissionId: string
  writerRevokedAt: Date | null
  releaseBlockedAt: Date | null
  hasPhotos: boolean
}

export type ReleaseStep = 'delete_folder' | 'revoke_permission'

export interface ReleasePlan<T extends ReleaseVolume> {
  calls: { step: ReleaseStep; volume: T }[]
  drops: T[]
  pending: T[]
}

export function volumeFolderName(shortId: string): string {
  return `Volume ${shortId}`
}

export function planVolumeReleases<T extends ReleaseVolume>(
  volumes: T[],
  now: Date,
  maxCalls: number
): ReleasePlan<T> {
  const plan: ReleasePlan<T> = { calls: [], drops: [], pending: [] }
  for (const volume of volumes) {
    if (volume.hasPhotos) {
      plan.pending.push(volume)
      continue
    }
    if (
      volume.releaseBlockedAt &&
      now.getTime() - volume.releaseBlockedAt.getTime() < RELEASE_RETRY_MS
    ) {
      plan.pending.push(volume)
      continue
    }
    if (volume.driveFolderId) {
      if (plan.calls.length >= maxCalls) plan.pending.push(volume)
      else plan.calls.push({ step: 'delete_folder', volume })
    } else if (volume.permissionId && !volume.writerRevokedAt) {
      if (plan.calls.length >= maxCalls) plan.pending.push(volume)
      else plan.calls.push({ step: 'revoke_permission', volume })
    } else {
      plan.drops.push(volume)
    }
  }
  return plan
}

export function planRecoveryShare(volume: {
  driveFolderId: string | null
  permissionId: string
  writerRevokedAt: Date | null
  hasPhotoRows: boolean
}): boolean {
  if (!volume.driveFolderId || volume.hasPhotoRows) return false
  return !volume.permissionId || !!volume.writerRevokedAt
}

export function volumeParents(
  albumFolderId: string,
  volumeFolderId: string | null
): string[] {
  return volumeFolderId ? [volumeFolderId, albumFolderId] : [albumFolderId]
}
