export const RELEASE_RETRY_MS = 6 * 60 * 60 * 1000

export const RELEASE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_HEAL_DELETES = 50

export interface ReleaseVolume {
  albumId: string
  driveFolderId: string | null
  releaseBlockedAt: Date | null
  releaseBlockedSince: Date | null
  hasPhotos: boolean
}

export interface ReleasePlan<T extends ReleaseVolume> {
  calls: T[]
  drops: T[]
  pending: T[]
  abandoned: T[]
}

export function volumeFolderName(shortId: string): string {
  return `Volume ${shortId}`
}

export function releaseAbandonedCutoff(now: Date): Date {
  return new Date(now.getTime() - RELEASE_FALLBACK_MS)
}

export function isReleaseAbandoned(
  volume: { releaseBlockedSince: Date | null },
  now: Date
): boolean {
  return (
    !!volume.releaseBlockedSince &&
    volume.releaseBlockedSince.getTime() <=
      releaseAbandonedCutoff(now).getTime()
  )
}

export function planVolumeReleases<T extends ReleaseVolume>(
  volumes: T[],
  now: Date,
  maxCalls: number
): ReleasePlan<T> {
  const plan: ReleasePlan<T> = {
    calls: [],
    drops: [],
    pending: [],
    abandoned: [],
  }
  for (const volume of volumes) {
    if (volume.hasPhotos) {
      plan.pending.push(volume)
      continue
    }
    const waiting =
      !!volume.releaseBlockedAt &&
      now.getTime() - volume.releaseBlockedAt.getTime() < RELEASE_RETRY_MS
    if (waiting) {
      if (isReleaseAbandoned(volume, now)) plan.abandoned.push(volume)
      else plan.pending.push(volume)
      continue
    }
    if (!volume.driveFolderId) {
      plan.drops.push(volume)
    } else if (plan.calls.length >= maxCalls) {
      plan.pending.push(volume)
    } else {
      plan.calls.push(volume)
    }
  }
  return plan
}

export function planHealDeletes(
  listedIds: string[],
  referencedIds: Iterable<string>,
  max: number = MAX_HEAL_DELETES
): string[] {
  const referenced = new Set(referencedIds)
  const picked: string[] = []
  for (const id of listedIds) {
    if (picked.length >= max) break
    if (!referenced.has(id) && !picked.includes(id)) picked.push(id)
  }
  return picked
}

export function abandonedAlertText(who: string, albumTitle: string): string {
  return `#savenuimg: a volume of ${who} in the album "${albumTitle}" could not be emptied for 7 days. Its Drive subfolder still holds files that need manual cleanup.`
}

export function planRecoveryShare(volume: {
  driveFolderId: string | null
  permissionId: string
  hasPhotoRows: boolean
}): boolean {
  if (!volume.driveFolderId || volume.hasPhotoRows) return false
  return !volume.permissionId
}

export function volumeParents(volumeFolderId: string | null): string[] {
  return volumeFolderId ? [volumeFolderId] : []
}
