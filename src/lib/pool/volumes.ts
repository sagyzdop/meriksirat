export const RELEASE_RETRY_MS = 6 * 60 * 60 * 1000

export const RELEASE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_HEAL_DELETES = 50

export type HealOutcome = 'cleared' | 'blocked' | 'incomplete'

export interface HealTally {
  cleared: number
  blocked: number
  incomplete: number
}

export type AlbumFolderDecision = 'retry' | 'defer' | 'abandon'

export function tallyHeals(outcomes: HealOutcome[]): HealTally {
  const tally: HealTally = { cleared: 0, blocked: 0, incomplete: 0 }
  for (const outcome of outcomes) tally[outcome]++
  return tally
}

export function decideAlbumFolder(
  tally: HealTally,
  retried: boolean
): AlbumFolderDecision {
  if (tally.incomplete > 0) return 'defer'
  if (!retried && tally.blocked === 0 && tally.cleared > 0) return 'retry'
  return 'abandon'
}

export function rotateIds<T>(ids: T[], turn: number): T[] {
  if (ids.length === 0) return ids
  const start = ((Math.floor(turn) % ids.length) + ids.length) % ids.length
  return [...ids.slice(start), ...ids.slice(0, start)]
}

export interface ReleaseVolume {
  albumId: string
  driveFolderId: string | null
  releaseLastBlockedAt: Date | null
  releaseFirstBlockedAt: Date | null
  releaseAlertedAt?: Date | null
}

export interface ReleasePlan<T extends ReleaseVolume> {
  calls: T[]
  drops: T[]
  pending: T[]
}

export function volumeFolderName(shortId: string): string {
  return `Volume ${shortId}`
}

export function releaseAbandonedCutoff(now: Date): Date {
  return new Date(now.getTime() - RELEASE_FALLBACK_MS)
}

export function isReleaseAbandoned(
  volume: { releaseFirstBlockedAt: Date | null },
  now: Date
): boolean {
  return (
    !!volume.releaseFirstBlockedAt &&
    volume.releaseFirstBlockedAt.getTime() <=
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
  }
  for (const volume of volumes) {
    if (volume.releaseAlertedAt && isReleaseAbandoned(volume, now)) continue
    const waiting =
      !!volume.releaseLastBlockedAt &&
      now.getTime() - volume.releaseLastBlockedAt.getTime() < RELEASE_RETRY_MS
    if (waiting) {
      if (!isReleaseAbandoned(volume, now)) plan.pending.push(volume)
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

export function albumBlockedAlertText(
  albumId: string,
  blocked: number
): string {
  if (blocked <= 0) {
    return `#savenuimg: album ${albumId} was deleted but its Drive folder could not be removed, so it may still hold public files that need manual cleanup.`
  }
  return `#savenuimg: album ${albumId} was deleted but ${blocked} of its volume subfolders could not be emptied, so its Drive folder may still hold public files that need manual cleanup.`
}

export function planRecoveryShare(volume: {
  driveFolderId: string | null
  permissionId: string
  hasPhotoRows: boolean
}): boolean {
  if (!volume.driveFolderId || volume.hasPhotoRows) return false
  return !volume.permissionId
}

export function isInVolumeFolder(
  file: { trashed?: boolean; parents?: string[] },
  volumeFolderId: string | null
): boolean {
  return (
    !file.trashed &&
    !!volumeFolderId &&
    !!file.parents?.includes(volumeFolderId)
  )
}
