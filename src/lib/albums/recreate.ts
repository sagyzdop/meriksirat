import { DriveAuthError } from '@/lib/google/google-drive'
import type { DriveFolderState } from '@/lib/google/google-drive'
import { MAX_HEAL_DELETES } from '@/lib/pool/volumes'

export const RECREATE_MAX_FILES = MAX_HEAL_DELETES * 4
export const RECREATE_MAX_OWNERS = 6

export interface RecreateRow {
  id: string
  driveFileId: string
  bytes: number
  flamekeeperUserId: string | null
}

export interface RecreateGroup {
  owner: string | null
  rows: RecreateRow[]
}

export type DeleteVerdict = 'gone' | 'retry' | 'give_up'

export interface RecreateTally {
  removed: number
  abandoned: number
}

export function folderCheckVerdict(
  outcome: { state: DriveFolderState } | { error: unknown }
): 'missing' | 'exists' | 'unknown' {
  if (!('state' in outcome)) return 'unknown'
  return outcome.state === 'missing' ? 'missing' : 'exists'
}

export function classifyDeleteResult(
  result: { status: number; body: string } | undefined
): DeleteVerdict {
  if (!result) return 'retry'
  const { status, body } = result
  if (status < 300 || status === 404) return 'gone'
  if (status === 408 || status === 429 || status >= 500) return 'retry'
  if (status === 403 && /LimitExceeded/i.test(body)) return 'retry'
  return 'give_up'
}

export function classifyDeleteError(error: unknown): DeleteVerdict {
  if (error instanceof DriveAuthError) return 'give_up'
  if (
    error instanceof Error &&
    error.name === 'FlamekeeperGrantError' &&
    (error as Error & { revoked?: boolean }).revoked === true
  ) {
    return 'give_up'
  }
  return 'retry'
}

export function planRecreateDeletes(
  rows: RecreateRow[],
  maxFiles: number = RECREATE_MAX_FILES,
  maxOwners: number = RECREATE_MAX_OWNERS
): RecreateGroup[] {
  const groups = new Map<string | null, RecreateRow[]>()
  let files = 0
  for (const row of rows) {
    if (files >= maxFiles) break
    const key = row.flamekeeperUserId
    let group = groups.get(key)
    if (!group) {
      if (groups.size >= maxOwners) continue
      group = []
      groups.set(key, group)
    }
    group.push(row)
    files += 1
  }
  return [...groups].map(([owner, groupRows]) => ({ owner, rows: groupRows }))
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

export function pressAgainMessage(
  tally: RecreateTally,
  remaining: number
): string {
  const left =
    tally.abandoned > 0
      ? ` ${plural(tally.abandoned, 'file', 'files')} couldn't be deleted.`
      : ''
  return `Removed ${plural(tally.removed, 'file', 'files')} so far, ${remaining} to go.${left} Press "Recreate folder" again to continue. The new folder is created once all files are processed.`
}

export function recreateSummary(tally: RecreateTally): string {
  const parts = ['Album folder recreated.']
  if (tally.removed > 0) {
    parts.push(
      `${plural(tally.removed, 'file', 'files')} removed from Google Drive.`
    )
  }
  if (tally.abandoned > 0) {
    parts.push(
      `${plural(tally.abandoned, 'file', 'files')} couldn't be deleted.`
    )
  }
  return parts.join(' ')
}

export function abandonedAlertText(
  who: string,
  albumTitle: string,
  files: number
): string {
  return `#savenuimg: ${plural(files, 'file', 'files')} of ${who} in the recreated album "${albumTitle}" could not be deleted and were left in their Drive.`
}
