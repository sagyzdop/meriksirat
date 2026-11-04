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

export function volumeFolderName(shortId: string): string {
  return `Volume ${shortId}`
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

export function albumBlockedAlertText(
  albumId: string,
  blocked: number
): string {
  if (blocked <= 0) {
    return `#savenuimg: album ${albumId} was deleted but its Drive folder could not be removed, so it may still hold public files that need manual cleanup.`
  }
  return `#savenuimg: album ${albumId} was deleted but ${blocked} of its volume subfolders could not be emptied, so its Drive folder may still hold public files that need manual cleanup.`
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
