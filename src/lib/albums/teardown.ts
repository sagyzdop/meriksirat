import type { ListingOwner } from './listing'

export const FILES_PER_DELETE_REQUEST = 100
export const TEARDOWN_RESERVE_REQUESTS = 4

export interface TeardownFile {
  id: string
  bytes: number
}

export type TeardownReading =
  | { kind: 'listed'; files: TeardownFile[]; complete: boolean }
  | { kind: 'gone' }
  | { kind: 'failed' }
  | { kind: 'skipped' }
  | { kind: 'unreachable' }

export interface TeardownSource {
  key: string
  owner: ListingOwner
  reading: TeardownReading
}

export interface TeardownDelete {
  key: string
  owner: ListingOwner
  files: TeardownFile[]
}

export interface TeardownPlan {
  deletes: TeardownDelete[]
  abandoned: string[]
  complete: boolean
}

export type TeardownVerdict = 'finished' | 'retry'

export function deleteAllowance(remainingRequests: number): number {
  const spare = Math.floor(remainingRequests) - TEARDOWN_RESERVE_REQUESTS
  return spare > 0 ? spare * FILES_PER_DELETE_REQUEST : 0
}

export function planTeardown(
  sources: TeardownSource[],
  allowance: number
): TeardownPlan {
  const deletes: TeardownDelete[] = []
  const abandoned: string[] = []
  let complete = true
  let room = Math.max(0, allowance)

  for (const { key, owner, reading } of sources) {
    switch (reading.kind) {
      case 'gone':
        break
      case 'unreachable':
        abandoned.push(key)
        break
      case 'failed':
      case 'skipped':
        complete = false
        break
      case 'listed': {
        if (!reading.complete) complete = false
        const take = reading.files.slice(0, room)
        if (take.length < reading.files.length) complete = false
        if (take.length > 0) {
          room -= take.length
          deletes.push({ key, owner, files: take })
        }
      }
    }
  }
  return { deletes, abandoned, complete }
}

function ownerKey(owner: ListingOwner): string {
  switch (owner.kind) {
    case 'master':
      return 'master'
    case 'buffer':
      return `buffer:${owner.grantId ?? ''}`
    case 'flamekeeper':
      return `flamekeeper:${owner.userId}`
  }
}

/**
 * The planned deletes grouped by the token that deletes them, so an album
 * split into many volumes costs one batch per owner instead of one per volume.
 */
export function groupDeletesByOwner(
  deletes: TeardownDelete[]
): TeardownDelete[][] {
  const groups = new Map<string, TeardownDelete[]>()
  for (const del of deletes) {
    const key = ownerKey(del.owner)
    groups.set(key, [...(groups.get(key) ?? []), del])
  }
  return [...groups.values()]
}

export function settleTeardown(
  plan: TeardownPlan,
  results: Record<string, { failed: number; threw?: boolean }>
): TeardownVerdict {
  if (!plan.complete) return 'retry'
  for (const { key } of plan.deletes) {
    const result = results[key]
    if (!result || result.threw || result.failed > 0) return 'retry'
  }
  return 'finished'
}
