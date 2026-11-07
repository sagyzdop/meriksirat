import type { AlbumStorageHolder } from './status'

export type MoveTarget = 'buffer' | 'flamekeeper'

export interface PlacementCandidate {
  userId: string
  name?: string
  freeBytes: number
}

export interface MoveAlbumInput {
  albumId: string
  title: string
  bytes: number
  holder: AlbumStorageHolder
  deleted?: boolean
}

export interface MovePreviewItem {
  albumId: string
  title: string
  from: AlbumStorageHolder
  to: MoveTarget
  bytes: number
  flamekeeperUserId?: string
  flamekeeperName?: string
  skipReason?: string
}

export interface MovePreviewCounts {
  selected: number
  onBuffer: number
  onFlamekeeper: number
  unknown: number
  movable: number
  skipped: number
}

export interface MovePreview {
  items: MovePreviewItem[]
  counts: MovePreviewCounts
}

export function pickFlamekeeper(
  bytes: number,
  candidates: PlacementCandidate[]
): PlacementCandidate | null {
  let best: PlacementCandidate | null = null
  for (const c of candidates) {
    if (c.freeBytes < bytes) continue
    if (
      !best ||
      c.freeBytes > best.freeBytes ||
      (c.freeBytes === best.freeBytes && c.userId < best.userId)
    ) {
      best = c
    }
  }
  return best
}

export function planMoves(input: {
  albums: MoveAlbumInput[]
  target: MoveTarget
  candidates: PlacementCandidate[]
}): MovePreview {
  const free = new Map(input.candidates.map((c) => [c.userId, c.freeBytes]))
  const items: MovePreviewItem[] = []
  const counts: MovePreviewCounts = {
    selected: input.albums.length,
    onBuffer: 0,
    onFlamekeeper: 0,
    unknown: 0,
    movable: 0,
    skipped: 0,
  }

  for (const a of input.albums) {
    if (a.holder === 'buffer') counts.onBuffer++
    else if (a.holder === 'flamekeeper') counts.onFlamekeeper++
    else counts.unknown++

    const item: MovePreviewItem = {
      albumId: a.albumId,
      title: a.title,
      from: a.holder,
      to: input.target,
      bytes: a.bytes,
    }
    if (a.deleted) item.skipReason = 'Album was deleted'
    else if (a.holder === 'none') item.skipReason = 'No storage record'
    else if (input.target === 'buffer' && a.holder === 'buffer') {
      item.skipReason = 'Already on the buffer'
    } else if (input.target === 'flamekeeper' && a.holder === 'flamekeeper') {
      item.skipReason = 'Already on a flamekeeper'
    } else if (input.target === 'flamekeeper') {
      const pick = pickFlamekeeper(
        a.bytes,
        input.candidates.map((c) => ({
          ...c,
          freeBytes: free.get(c.userId) ?? 0,
        }))
      )
      if (!pick) item.skipReason = 'No flamekeeper has room'
      else {
        item.flamekeeperUserId = pick.userId
        item.flamekeeperName = pick.name
        free.set(pick.userId, (free.get(pick.userId) ?? 0) - a.bytes)
      }
    }

    if (item.skipReason) counts.skipped++
    else counts.movable++
    items.push(item)
  }
  return { items, counts }
}

export interface FileIdentity {
  id: string
  name: string
  size: number
  md5: string
}

export interface FileMatch {
  pairs: { source: FileIdentity; copy: FileIdentity }[]
  missing: FileIdentity[]
}

export function matchFiles(
  source: FileIdentity[],
  copies: FileIdentity[]
): FileMatch {
  const pool = new Map<string, FileIdentity[]>()
  for (const c of copies) {
    const key = `${c.md5}:${c.size}:${c.name}`
    pool.set(key, [...(pool.get(key) ?? []), c])
  }
  const pairs: FileMatch['pairs'] = []
  const missing: FileIdentity[] = []
  for (const s of source) {
    const copy = pool.get(`${s.md5}:${s.size}:${s.name}`)?.shift()
    if (copy) pairs.push({ source: s, copy })
    else missing.push(s)
  }
  return { pairs, missing }
}

export function verifyCopy(
  source: FileIdentity[],
  copies: FileIdentity[]
): { ok: boolean; reason?: string } {
  if (copies.length < source.length) {
    return { ok: false, reason: 'Some files were not copied' }
  }
  const sourceBytes = source.reduce((n, f) => n + f.size, 0)
  const match = matchFiles(source, copies)
  if (match.missing.length > 0) {
    return { ok: false, reason: 'A copied file did not match its original' }
  }
  const matchedBytes = match.pairs.reduce((n, p) => n + p.copy.size, 0)
  if (matchedBytes !== sourceBytes) {
    return { ok: false, reason: 'Copied size differs from the original' }
  }
  return { ok: true }
}

export function bufferHasRoom(
  usedBytes: number,
  limitBytes: number | null,
  incomingBytes: number
): boolean {
  if (limitBytes === null) return true
  return usedBytes + incomingBytes <= limitBytes
}

export function deletionDate(now: Date, noticeDays: number): Date {
  return new Date(now.getTime() + noticeDays * 24 * 60 * 60 * 1000)
}

export function deletionRecipients(
  ownerUserId: string,
  favoriterUserIds: string[]
): string[] {
  return [...new Set([ownerUserId, ...favoriterUserIds])]
}

export function deletionNoticeText(
  title: string,
  dateText: string,
  albumUrl?: string
): string {
  const link = albumUrl ? `\n${albumUrl}` : ''
  return `The album "${title}" is scheduled for deletion on ${dateText}. Download any photos you want to keep before then.${link}`
}

export interface OffloadPending {
  destUserId: string
  volumeFolderId: string
  permissionId: string
  bytes: number
  files: (FileIdentity & { mimeType: string })[]
}

export function pendingMatches(
  pending: OffloadPending,
  volumeFolderId: string,
  files: FileIdentity[]
): boolean {
  if (pending.volumeFolderId !== volumeFolderId) return false
  if (pending.files.length !== files.length) return false
  return matchFiles(pending.files, files).missing.length === 0
}

export type DrainStep =
  | { kind: 'finalize' }
  | { kind: 'pause'; alert: 'buffer_full' }
  | { kind: 'rescue' }

export function planDrainStep(input: {
  heldVolumes: number
  bufferFull: boolean
}): DrainStep {
  if (input.heldVolumes === 0) return { kind: 'finalize' }
  if (input.bufferFull) return { kind: 'pause', alert: 'buffer_full' }
  return { kind: 'rescue' }
}
